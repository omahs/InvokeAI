import { createSelector } from '@reduxjs/toolkit';
import { useHotkeys } from 'react-hotkeys-hook';
import { FaUndo } from 'react-icons/fa';
import { useAppDispatch, useAppSelector } from 'app/storeHooks';
import IAIIconButton from 'common/components/IAIIconButton';
import { canvasSelector } from 'features/canvas/store/canvasSelectors';

import _ from 'lodash';
import { activeTabNameSelector } from 'features/ui/store/uiSelectors';
import { undo } from 'features/canvas/store/canvasSlice';
import { systemSelector } from 'features/system/store/systemSelectors';
import { useTranslation } from 'react-i18next';

const canvasUndoSelector = createSelector(
  [canvasSelector, activeTabNameSelector, systemSelector],
  (canvas, activeTabName, system) => {
    const { pastLayerStates } = canvas;

    return {
      canUndo: pastLayerStates.length > 0 && !system.isProcessing,
      activeTabName,
    };
  },
  {
    memoizeOptions: {
      resultEqualityCheck: _.isEqual,
    },
  }
);

export default function IAICanvasUndoButton() {
  const dispatch = useAppDispatch();

  const { t } = useTranslation();

  const { canUndo, activeTabName } = useAppSelector(canvasUndoSelector);

  const handleUndo = () => {
    dispatch(undo());
  };

  useHotkeys(
    ['meta+z', 'ctrl+z'],
    () => {
      handleUndo();
    },
    {
      enabled: () => canUndo,
      preventDefault: true,
    },
    [activeTabName, canUndo]
  );

  return (
    <IAIIconButton
      aria-label={`${t('unifiedcanvas:undo')} (Ctrl+Z)`}
      tooltip={`${t('unifiedcanvas:undo')} (Ctrl+Z)`}
      icon={<FaUndo />}
      onClick={handleUndo}
      isDisabled={!canUndo}
    />
  );
}
