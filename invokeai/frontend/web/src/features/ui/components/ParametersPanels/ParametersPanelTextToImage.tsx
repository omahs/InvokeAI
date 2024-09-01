import type { ChakraProps } from '@invoke-ai/ui-library';
import { Box, Flex, Tab, TabList, TabPanel, TabPanels, Tabs } from '@invoke-ai/ui-library';
import { useStore } from '@nanostores/react';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { overlayScrollbarsParams } from 'common/components/OverlayScrollbars/constants';
import { CanvasPanelContent } from 'features/controlLayers/components/CanvasPanelContent';
import { selectIsSDXL } from 'features/controlLayers/store/paramsSlice';
import { isImageViewerOpenChanged } from 'features/gallery/store/gallerySlice';
import { Prompts } from 'features/parameters/components/Prompts/Prompts';
import { AdvancedSettingsAccordion } from 'features/settingsAccordions/components/AdvancedSettingsAccordion/AdvancedSettingsAccordion';
import { CompositingSettingsAccordion } from 'features/settingsAccordions/components/CompositingSettingsAccordion/CompositingSettingsAccordion';
import { GenerationSettingsAccordion } from 'features/settingsAccordions/components/GenerationSettingsAccordion/GenerationSettingsAccordion';
import { ImageSettingsAccordion } from 'features/settingsAccordions/components/ImageSettingsAccordion/ImageSettingsAccordion';
import { RefinerSettingsAccordion } from 'features/settingsAccordions/components/RefinerSettingsAccordion/RefinerSettingsAccordion';
import { StylePresetMenu } from 'features/stylePresets/components/StylePresetMenu';
import { StylePresetMenuTrigger } from 'features/stylePresets/components/StylePresetMenuTrigger';
import { $isMenuOpen } from 'features/stylePresets/store/isMenuOpen';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import type { CSSProperties } from 'react';
import { memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const overlayScrollbarsStyles: CSSProperties = {
  height: '100%',
  width: '100%',
};

const baseStyles: ChakraProps['sx'] = {
  fontWeight: 'semibold',
  fontSize: 'sm',
  color: 'base.300',
};

const selectedStyles: ChakraProps['sx'] = {
  borderColor: 'base.800',
  borderBottomColor: 'base.900',
  color: 'invokeBlue.300',
};

const ParametersPanelTextToImage = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const isSDXL = useAppSelector(selectIsSDXL);
  const onChangeTabs = useCallback(
    (i: number) => {
      if (i === 1) {
        dispatch(isImageViewerOpenChanged(false));
      }
    },
    [dispatch]
  );

  const ref = useRef<HTMLDivElement>(null);
  const isMenuOpen = useStore($isMenuOpen);

  return (
    <Flex w="full" h="full" flexDir="column" gap={2}>
      <StylePresetMenuTrigger />
      <Flex w="full" h="full" position="relative">
        <Box position="absolute" top={0} left={0} right={0} bottom={0} ref={ref}>
          {isMenuOpen && (
            <OverlayScrollbarsComponent defer style={overlayScrollbarsStyles} options={overlayScrollbarsParams.options}>
              <Flex gap={2} flexDirection="column" h="full" w="full">
                <StylePresetMenu />
              </Flex>
            </OverlayScrollbarsComponent>
          )}
          <OverlayScrollbarsComponent defer style={overlayScrollbarsStyles} options={overlayScrollbarsParams.options}>
            <Flex gap={2} flexDirection="column" h="full" w="full">
              <Prompts />
              <Tabs
                defaultIndex={0}
                variant="enclosed"
                display="flex"
                flexDir="column"
                w="full"
                h="full"
                gap={2}
                onChange={onChangeTabs}
              >
                <TabList gap={2} fontSize="sm" borderColor="base.800" alignItems="center" w="full" pe={1}>
                  <Tab sx={baseStyles} _selected={selectedStyles} data-testid="generation-tab-settings-tab-button">
                    {t('common.settingsLabel')}
                  </Tab>
                  <Tab
                    sx={baseStyles}
                    _selected={selectedStyles}
                    data-testid="generation-tab-control-layers-tab-button"
                  >
                    {t('controlLayers.layer_other')}
                  </Tab>
                </TabList>
                <TabPanels w="full" h="full">
                  <TabPanel p={0} w="full" h="full">
                    <Flex gap={2} flexDirection="column" h="full" w="full">
                      <ImageSettingsAccordion />
                      <GenerationSettingsAccordion />
                      <CompositingSettingsAccordion />
                      {isSDXL && <RefinerSettingsAccordion />}
                      <AdvancedSettingsAccordion />
                    </Flex>
                  </TabPanel>
                  <TabPanel p={0} w="full" h="full">
                    <CanvasPanelContent />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Flex>
          </OverlayScrollbarsComponent>
        </Box>
      </Flex>
    </Flex>
  );
};

export default memo(ParametersPanelTextToImage);
