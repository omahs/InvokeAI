import type { JSONObject } from 'common/types';
import { rgbColorToString } from 'common/util/colorCodeTransformers';
import { deepClone } from 'common/util/deepClone';
import { CanvasBrushLineRenderer } from 'features/controlLayers/konva/CanvasBrushLine';
import { CanvasEraserLineRenderer } from 'features/controlLayers/konva/CanvasEraserLine';
import { CanvasImageRenderer } from 'features/controlLayers/konva/CanvasImage';
import type { CanvasInpaintMask } from 'features/controlLayers/konva/CanvasInpaintMask';
import type { CanvasLayer } from 'features/controlLayers/konva/CanvasLayer';
import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasRectRenderer } from 'features/controlLayers/konva/CanvasRect';
import { getPrefixedId, konvaNodeToBlob, previewBlob } from 'features/controlLayers/konva/util';
import {
  type CanvasBrushLineState,
  type CanvasEraserLineState,
  type CanvasImageState,
  type CanvasRectState,
  imageDTOToImageObject,
  type RgbColor,
} from 'features/controlLayers/store/types';
import Konva from 'konva';
import type { Logger } from 'roarr';
import { uploadImage } from 'services/api/endpoints/images';
import { assert } from 'tsafe';

/**
 * Union of all object renderers.
 */
type AnyObjectRenderer = CanvasBrushLineRenderer | CanvasEraserLineRenderer | CanvasRectRenderer | CanvasImageRenderer;
/**
 * Union of all object states.
 */
type AnyObjectState = CanvasBrushLineState | CanvasEraserLineState | CanvasImageState | CanvasRectState;

/**
 * Handles rendering of objects for a canvas entity.
 */
export class CanvasObjectRenderer {
  static TYPE = 'object_renderer';
  static KONVA_OBJECT_GROUP_NAME = 'object-group';
  static KONVA_COMPOSITING_RECT_NAME = 'compositing-rect';

  id: string;
  parent: CanvasLayer | CanvasInpaintMask;
  manager: CanvasManager;
  log: Logger;
  getLoggingContext: (extra?: JSONObject) => JSONObject;

  /**
   * A set of subscriptions that should be cleaned up when the transformer is destroyed.
   */
  subscriptions: Set<() => void> = new Set();

  /**
   * A buffer object state that is rendered separately from the other objects. This is used for objects that are being
   * drawn in real-time, such as brush lines. The buffer object state only exists in this renderer and is not part of
   * the application state until it is committed.
   */
  buffer: AnyObjectState | null = null;

  /**
   * A map of object renderers, keyed by their ID.
   */
  renderers: Map<string, AnyObjectRenderer> = new Map();

  /**
   * A object containing singleton Konva nodes.
   */
  konva: {
    /**
     * A Konva Group that holds all the object renderers.
     */
    objectGroup: Konva.Group;
    /**
     * The compositing rect is used to draw the inpaint mask as a single shape with a given opacity.
     *
     * When drawing multiple transparent shapes on a canvas, overlapping regions will be more opaque. This doesn't
     * match the expectation for a mask, where all shapes should have the same opacity, even if they overlap.
     *
     * To prevent this, we use a trick. Instead of drawing all shapes at the desired opacity, we draw them at opacity of 1.
     * Then we draw a single rect that covers the entire canvas at the desired opacity, with a globalCompositeOperation
     * of 'source-in'. The shapes effectively become a mask for the "compositing rect".
     *
     * This node is only added when the parent of the renderer is an inpaint mask or region, which require this behavior.
     *
     * The compositing rect is not added to the object group.
     */
    compositingRect: Konva.Rect | null;
  };

  constructor(parent: CanvasLayer | CanvasInpaintMask) {
    this.id = getPrefixedId(CanvasObjectRenderer.TYPE);
    this.parent = parent;
    this.manager = parent.manager;
    this.getLoggingContext = this.manager.buildGetLoggingContext(this);
    this.log = this.manager.buildLogger(this.getLoggingContext);
    this.log.trace('Creating object renderer');

    this.konva = {
      objectGroup: new Konva.Group({ name: CanvasObjectRenderer.KONVA_OBJECT_GROUP_NAME, listening: false }),
      compositingRect: null,
    };

    this.parent.konva.layer.add(this.konva.objectGroup);

    if (this.parent.type === 'inpaint_mask') {
      this.konva.compositingRect = new Konva.Rect({
        name: CanvasObjectRenderer.KONVA_COMPOSITING_RECT_NAME,
        listening: false,
        globalCompositeOperation: 'source-in',
      });
      this.parent.konva.layer.add(this.konva.compositingRect);
    }

    this.subscriptions.add(
      this.manager.toolState.subscribe((newVal, oldVal) => {
        if (newVal.selected !== oldVal.selected) {
          this.commitBuffer();
        }
      })
    );

    // The compositing rect must cover the whole stage at all times. When the stage is scaled, moved or resized, we
    // need to update the compositing rect to match the stage.
    this.subscriptions.add(
      this.manager.stateApi.$stageAttrs.listen((attrs) => {
        if (this.konva.compositingRect) {
          this.konva.compositingRect.setAttrs({
            x: -attrs.position.x / attrs.scale,
            y: -attrs.position.y / attrs.scale,
            width: attrs.dimensions.width / attrs.scale,
            height: attrs.dimensions.height / attrs.scale,
          });
        }
      })
    );
  }

  /**
   * Renders the given objects.
   * @param objectStates The objects to render.
   * @returns A promise that resolves to a boolean, indicating if any of the objects were rendered.
   */
  render = async (objectStates: AnyObjectState[]): Promise<boolean> => {
    let didRender = false;
    const objectIds = objectStates.map((objectState) => objectState.id);

    for (const renderer of this.renderers.values()) {
      if (!objectIds.includes(renderer.id) && renderer.id !== this.buffer?.id) {
        this.renderers.delete(renderer.id);
        renderer.destroy();
        didRender = true;
      }
    }

    for (const objectState of objectStates) {
      didRender = (await this.renderObject(objectState)) || didRender;
    }

    if (this.buffer) {
      didRender = (await this.renderObject(this.buffer)) || didRender;
    }

    return didRender;
  };

  updateCompositingRect = (fill: RgbColor, opacity: number) => {
    this.log.trace('Updating compositing rect');
    assert(this.konva.compositingRect, 'Missing compositing rect');

    const rgbColor = rgbColorToString(fill);
    this.konva.compositingRect.setAttrs({
      fill: rgbColor,
      opacity,
    });
  };

  /**
   * Renders the given object. If the object renderer does not exist, it will be created and its Konva group added to the
   * parent entity's object group.
   * @param objectState The object's state.
   * @param force Whether to force the object to render, even if it has not changed. If omitted, the object renderer
   * will only render if the object state has changed. The exception is the first render, where the object will always
   * be rendered.
   * @returns A promise that resolves to a boolean, indicating if the object was rendered.
   */
  renderObject = async (objectState: AnyObjectState, force = false): Promise<boolean> => {
    let didRender = false;

    let renderer = this.renderers.get(objectState.id);

    const isFirstRender = renderer === undefined;

    if (objectState.type === 'brush_line') {
      assert(renderer instanceof CanvasBrushLineRenderer || renderer === undefined);

      if (!renderer) {
        renderer = new CanvasBrushLineRenderer(objectState, this);
        this.renderers.set(renderer.id, renderer);
        this.konva.objectGroup.add(renderer.konva.group);
      }

      didRender = renderer.update(objectState, force || isFirstRender);
    } else if (objectState.type === 'eraser_line') {
      assert(renderer instanceof CanvasEraserLineRenderer || renderer === undefined);

      if (!renderer) {
        renderer = new CanvasEraserLineRenderer(objectState, this);
        this.renderers.set(renderer.id, renderer);
        this.konva.objectGroup.add(renderer.konva.group);
      }

      didRender = renderer.update(objectState, force || isFirstRender);
    } else if (objectState.type === 'rect') {
      assert(renderer instanceof CanvasRectRenderer || renderer === undefined);

      if (!renderer) {
        renderer = new CanvasRectRenderer(objectState, this);
        this.renderers.set(renderer.id, renderer);
        this.konva.objectGroup.add(renderer.konva.group);
      }

      didRender = renderer.update(objectState, force || isFirstRender);
    } else if (objectState.type === 'image') {
      assert(renderer instanceof CanvasImageRenderer || renderer === undefined);

      if (!renderer) {
        renderer = new CanvasImageRenderer(objectState, this);
        this.renderers.set(renderer.id, renderer);
        this.konva.objectGroup.add(renderer.konva.group);
      }
      didRender = await renderer.update(objectState, force || isFirstRender);
    }

    return didRender;
  };

  /**
   * Determines if the renderer has a buffer object to render.
   * @returns Whether the renderer has a buffer object to render.
   */
  hasBuffer = (): boolean => {
    return this.buffer !== null;
  };

  /**
   * Sets the buffer object state to render.
   * @param objectState The object state to set as the buffer.
   * @returns A promise that resolves to a boolean, indicating if the object was rendered.
   */
  setBuffer = async (objectState: AnyObjectState): Promise<boolean> => {
    this.log.trace('Setting buffer object');

    this.buffer = objectState;
    return await this.renderObject(this.buffer, true);
  };

  /**
   * Clears the buffer object state.
   */
  clearBuffer = () => {
    this.log.trace('Clearing buffer object');

    this.buffer = null;
  };

  /**
   * Commits the current buffer object, pushing the buffer object state back to the application state.
   */
  commitBuffer = () => {
    if (!this.buffer) {
      this.log.trace('No buffer object to commit');
      return;
    }

    this.log.trace('Committing buffer object');

    // We need to give the objects a fresh ID else they will be considered the same object when they are re-rendered as
    // a non-buffer object, and we won't trigger things like bbox calculation
    this.buffer.id = getPrefixedId(this.buffer.type);

    if (this.buffer.type === 'brush_line') {
      this.manager.stateApi.addBrushLine({ id: this.parent.id, brushLine: this.buffer }, this.parent.type);
    } else if (this.buffer.type === 'eraser_line') {
      this.manager.stateApi.addEraserLine({ id: this.parent.id, eraserLine: this.buffer }, this.parent.type);
    } else if (this.buffer.type === 'rect') {
      this.manager.stateApi.addRect({ id: this.parent.id, rect: this.buffer }, this.parent.type);
    } else {
      this.log.warn({ buffer: this.buffer }, 'Invalid buffer object type');
    }

    this.buffer = null;
  };

  /**
   * Determines if the objects in the renderer require a pixel bbox calculation.
   *
   * In some cases, we can use Konva's getClientRect as the bbox, but it is not always accurate. It includes
   * these visually transparent shapes in its calculation:
   *
   * - Eraser lines, which are normal lines with a globalCompositeOperation of 'destination-out'.
   * - Clipped portions of any shape.
   * - Images, which may have transparent areas.
   */
  needsPixelBbox = (): boolean => {
    let needsPixelBbox = false;
    for (const renderer of this.renderers.values()) {
      const isEraserLine = renderer instanceof CanvasEraserLineRenderer;
      const isImage = renderer instanceof CanvasImageRenderer;
      const hasClip = renderer instanceof CanvasBrushLineRenderer && renderer.state.clip;
      if (isEraserLine || hasClip || isImage) {
        needsPixelBbox = true;
        break;
      }
    }
    return needsPixelBbox;
  };

  /**
   * Checks if the renderer has any objects to render, including its buffer.
   * @returns Whether the renderer has any objects to render.
   */
  hasObjects = (): boolean => {
    return this.renderers.size > 0 || this.buffer !== null;
  };

  rasterize = async () => {
    this.log.debug('Rasterizing entity');

    const objectGroupClone = this.konva.objectGroup.clone();
    const interactionRectClone = this.parent.transformer.konva.proxyRect.clone();
    const rect = interactionRectClone.getClientRect();
    const blob = await konvaNodeToBlob(objectGroupClone, rect);
    if (this.manager._isDebugging) {
      previewBlob(blob, 'Rasterized layer');
    }
    const imageDTO = await uploadImage(blob, `${this.id}_rasterized.png`, 'other', true);
    const imageObject = imageDTOToImageObject(imageDTO);
    await this.renderObject(imageObject, true);
    this.manager.stateApi.rasterizeEntity(
      { id: this.id, imageObject, position: { x: Math.round(rect.x), y: Math.round(rect.y) } },
      this.parent.type
    );
  };

  /**
   * Destroys this renderer and all of its object renderers.
   */
  destroy = () => {
    this.log.trace('Destroying object renderer');
    for (const cleanup of this.subscriptions) {
      this.log.trace('Cleaning up listener');
      cleanup();
    }
    for (const renderer of this.renderers.values()) {
      renderer.destroy();
    }
    this.renderers.clear();
  };

  /**
   * Gets a serializable representation of the renderer.
   * @returns A serializable representation of the renderer.
   */
  repr = () => {
    return {
      id: this.id,
      type: CanvasObjectRenderer.TYPE,
      parent: this.parent.id,
      renderers: Array.from(this.renderers.values()).map((renderer) => renderer.repr()),
      buffer: deepClone(this.buffer),
    };
  };
}
