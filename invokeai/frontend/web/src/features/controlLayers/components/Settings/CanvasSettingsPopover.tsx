import {
  Divider,
  Flex,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  useShiftModifier,
} from '@invoke-ai/ui-library';
import { CanvasSettingsAutoSaveCheckbox } from 'features/controlLayers/components/Settings/CanvasSettingsAutoSaveCheckbox';
import { CanvasSettingsBboxOverlaySwitch } from 'features/controlLayers/components/Settings/CanvasSettingsBboxOverlaySwitch';
import { CanvasSettingsClearCachesButton } from 'features/controlLayers/components/Settings/CanvasSettingsClearCachesButton';
import { CanvasSettingsClearHistoryButton } from 'features/controlLayers/components/Settings/CanvasSettingsClearHistoryButton';
import { CanvasSettingsClipToBboxCheckbox } from 'features/controlLayers/components/Settings/CanvasSettingsClipToBboxCheckbox';
import { CanvasSettingsDynamicGridSwitch } from 'features/controlLayers/components/Settings/CanvasSettingsDynamicGridSwitch';
import { CanvasSettingsSnapToGridCheckbox } from 'features/controlLayers/components/Settings/CanvasSettingsGridSize';
import { CanvasSettingsInvertScrollCheckbox } from 'features/controlLayers/components/Settings/CanvasSettingsInvertScrollCheckbox';
import { CanvasSettingsLogDebugInfoButton } from 'features/controlLayers/components/Settings/CanvasSettingsLogDebugInfo';
import { CanvasSettingsOutputOnlyMaskedRegionsCheckbox } from 'features/controlLayers/components/Settings/CanvasSettingsOutputOnlyMaskedRegionsCheckbox';
import { CanvasSettingsPreserveMaskCheckbox } from 'features/controlLayers/components/Settings/CanvasSettingsPreserveMaskCheckbox';
import { CanvasSettingsRecalculateRectsButton } from 'features/controlLayers/components/Settings/CanvasSettingsRecalculateRectsButton';
import { CanvasSettingsShowHUDSwitch } from 'features/controlLayers/components/Settings/CanvasSettingsShowHUDSwitch';
import { CanvasSettingsShowProgressOnCanvas } from 'features/controlLayers/components/Settings/CanvasSettingsShowProgressOnCanvasSwitch';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiGearSixFill } from 'react-icons/pi';

export const CanvasSettingsPopover = memo(() => {
  const { t } = useTranslation();
  return (
    <Popover isLazy>
      <PopoverTrigger>
        <IconButton aria-label={t('common.settingsLabel')} icon={<PiGearSixFill />} variant="ghost" />
      </PopoverTrigger>
      <PopoverContent>
        <PopoverArrow />
        <PopoverBody>
          <Flex direction="column" gap={2}>
            <CanvasSettingsAutoSaveCheckbox />
            <CanvasSettingsInvertScrollCheckbox />
            <CanvasSettingsPreserveMaskCheckbox />
            <CanvasSettingsClipToBboxCheckbox />
            <CanvasSettingsOutputOnlyMaskedRegionsCheckbox />
            <CanvasSettingsSnapToGridCheckbox />
            <CanvasSettingsShowProgressOnCanvas />
            <CanvasSettingsDynamicGridSwitch />
            <CanvasSettingsBboxOverlaySwitch />
            <CanvasSettingsShowHUDSwitch />
            <DebugSettings />
          </Flex>
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
});

CanvasSettingsPopover.displayName = 'CanvasSettingsPopover';

const DebugSettings = () => {
  const shift = useShiftModifier();

  if (!shift) {
    return null;
  }

  return (
    <>
      <Divider />
      <CanvasSettingsClearCachesButton />
      <CanvasSettingsRecalculateRectsButton />
      <CanvasSettingsLogDebugInfoButton />
      <CanvasSettingsClearHistoryButton />
    </>
  );
};
