import type { CanvasManager } from 'features/controlLayers/konva/CanvasManager';
import { CanvasObjectRenderer } from 'features/controlLayers/konva/CanvasObjectRenderer';
import { CanvasTransformer } from 'features/controlLayers/konva/CanvasTransformer';
import type { CanvasInpaintMaskState, CanvasV2State, GetLoggingContext } from 'features/controlLayers/store/types';
import Konva from 'konva';
import { get } from 'lodash-es';
import type { Logger } from 'roarr';
import { assert } from 'tsafe';

export class CanvasInpaintMask {
  static TYPE = 'inpaint_mask' as const;
  static NAME_PREFIX = 'inpaint-mask';
  static KONVA_LAYER_NAME = `${CanvasInpaintMask.NAME_PREFIX}_layer`;
  static OBJECT_GROUP_NAME = `${CanvasInpaintMask.NAME_PREFIX}_object-group`;

  id = CanvasInpaintMask.TYPE;
  type = CanvasInpaintMask.TYPE;
  manager: CanvasManager;
  log: Logger;
  getLoggingContext: GetLoggingContext;

  state: CanvasInpaintMaskState;

  transformer: CanvasTransformer;
  renderer: CanvasObjectRenderer;

  isFirstRender: boolean = true;

  konva: {
    layer: Konva.Layer;
    objectGroup: Konva.Group;
  };

  constructor(state: CanvasInpaintMaskState, manager: CanvasManager) {
    this.manager = manager;
    this.getLoggingContext = this.manager.buildGetLoggingContext(this);
    this.log = this.manager.buildLogger(this.getLoggingContext);
    this.log.debug({ state }, 'Creating inpaint mask');

    this.konva = {
      layer: new Konva.Layer({
        name: CanvasInpaintMask.KONVA_LAYER_NAME,
        listening: false,
        imageSmoothingEnabled: false,
      }),
      objectGroup: new Konva.Group({ name: CanvasInpaintMask.OBJECT_GROUP_NAME, listening: false }),
    };

    this.transformer = new CanvasTransformer(this);
    this.renderer = new CanvasObjectRenderer(this, true);
    assert(this.renderer.konva.compositingRect, 'Compositing rect must be set');

    this.konva.layer.add(this.konva.objectGroup);
    this.konva.layer.add(this.renderer.konva.compositingRect);
    this.konva.layer.add(...this.transformer.getNodes());

    this.state = state;
  }

  destroy = (): void => {
    this.log.debug('Destroying inpaint mask');
    // We need to call the destroy method on all children so they can do their own cleanup.
    this.transformer.destroy();
    this.renderer.destroy();
    this.konva.layer.destroy();
  };

  update = async (arg?: { state: CanvasInpaintMaskState; toolState: CanvasV2State['tool']; isSelected: boolean }) => {
    const state = get(arg, 'state', this.state);

    if (!this.isFirstRender && state === this.state) {
      this.log.trace('State unchanged, skipping update');
      return;
    }

    // const maskOpacity = this.manager.stateApi.getMaskOpacity()

    this.log.debug('Updating');
    const { position, objects, isEnabled } = state;

    if (this.isFirstRender || objects !== this.state.objects) {
      await this.updateObjects({ objects });
    }
    if (this.isFirstRender || position !== this.state.position) {
      await this.transformer.updatePosition({ position });
    }
    // if (this.isFirstRender || opacity !== this.state.opacity) {
    //   await this.updateOpacity({ opacity });
    // }
    if (this.isFirstRender || isEnabled !== this.state.isEnabled) {
      await this.updateVisibility({ isEnabled });
    }
    // this.transformer.syncInteractionState();

    if (this.isFirstRender) {
      await this.transformer.updateBbox();
    }

    this.state = state;
    this.isFirstRender = false;
  };

  updateObjects = async (arg?: { objects: CanvasInpaintMaskState['objects'] }) => {
    this.log.trace('Updating objects');

    const objects = get(arg, 'objects', this.state.objects);

    const didUpdate = await this.renderer.render(objects);

    if (didUpdate) {
      this.transformer.requestRectCalculation();
    }

    this.isFirstRender = false;
  };

  // updateOpacity = (arg?: { opacity: number }) => {
  //   this.log.trace('Updating opacity');
  //   const opacity = get(arg, 'opacity', this.state.opacity);
  //   this.konva.objectGroup.opacity(opacity);
  // };

  updateVisibility = (arg?: { isEnabled: boolean }) => {
    this.log.trace('Updating visibility');
    const isEnabled = get(arg, 'isEnabled', this.state.isEnabled);
    this.konva.layer.visible(isEnabled && this.renderer.hasObjects());
  };
}
