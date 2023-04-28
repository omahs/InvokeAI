import {
  Box,
  ButtonGroup,
  Collapse,
  Flex,
  Heading,
  HStack,
  Image,
  Spacer,
  Text,
  useDisclosure,
  VStack,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';

import IAIButton from 'common/components/IAIButton';
import ImageFit from 'features/parameters/components/AdvancedParameters/ImageToImage/ImageFit';
import ImageToImageStrength from 'features/parameters/components/AdvancedParameters/ImageToImage/ImageToImageStrength';
import IAIIconButton from 'common/components/IAIIconButton';

import { useTranslation } from 'react-i18next';
import { FaUndo, FaUpload } from 'react-icons/fa';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { RootState } from 'app/store/store';
import { useCallback } from 'react';
import { clearInitialImage } from 'features/parameters/store/generationSlice';

const ImageToImageSettingsHeader = () => {
  const isImageToImageEnabled = useAppSelector(
    (state: RootState) => state.generation.isImageToImageEnabled
  );
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const handleResetInitialImage = useCallback(() => {
    dispatch(clearInitialImage());
  }, [dispatch]);

  return (
    <Flex w="full" alignItems="center">
      <Text size="sm" fontWeight={500} color="base.300">
        Image to Image
      </Text>
      <Spacer />
      <ButtonGroup>
        <IAIIconButton
          size="sm"
          icon={<FaUndo />}
          aria-label={t('accessibility.reset')}
          onClick={handleResetInitialImage}
        />
        <IAIIconButton
          size="sm"
          icon={<FaUpload />}
          aria-label={t('common.upload')}
        />
      </ButtonGroup>
    </Flex>
  );
};

export default ImageToImageSettingsHeader;
