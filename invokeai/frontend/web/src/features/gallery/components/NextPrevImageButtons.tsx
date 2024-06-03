import type { ChakraProps } from '@invoke-ai/ui-library';
import { Box, Flex, IconButton, Spinner } from '@invoke-ai/ui-library';
import { useGalleryImages, useGalleryPagination } from 'features/gallery/hooks/useGalleryImages';
import { useGalleryNavigation } from 'features/gallery/hooks/useGalleryNavigation';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PiCaretDoubleRightBold, PiCaretLeftBold, PiCaretRightBold } from 'react-icons/pi';

const nextPrevButtonStyles: ChakraProps['sx'] = {
  color: 'base.100',
  pointerEvents: 'auto',
};

const NextPrevImageButtons = () => {
  const { t } = useTranslation();

  const { prevImage, nextImage, isOnFirstImage, isOnLastImage } = useGalleryNavigation();
  const { isFetching } = useGalleryImages().queryResult;

  const { isNextEnabled, next } = useGalleryPagination();

  return (
    <Box pos="relative" h="full" w="full">
      <Box pos="absolute" top="50%" transform="translate(0, -50%)" insetInlineStart={1}>
        {!isOnFirstImage && (
          <IconButton
            aria-label={t('accessibility.previousImage')}
            icon={<PiCaretLeftBold size={64} />}
            variant="unstyled"
            onClick={prevImage}
            boxSize={16}
            sx={nextPrevButtonStyles}
          />
        )}
      </Box>
      <Box pos="absolute" top="50%" transform="translate(0, -50%)" insetInlineEnd={6}>
        {!isOnLastImage && (
          <IconButton
            aria-label={t('accessibility.nextImage')}
            icon={<PiCaretRightBold size={64} />}
            variant="unstyled"
            onClick={nextImage}
            boxSize={16}
            sx={nextPrevButtonStyles}
          />
        )}
        {isOnLastImage && isNextEnabled && !isFetching && (
          <IconButton
            aria-label={t('accessibility.loadMore')}
            icon={<PiCaretDoubleRightBold size={64} />}
            variant="unstyled"
            onClick={next}
            boxSize={16}
            sx={nextPrevButtonStyles}
          />
        )}
        {isOnLastImage && isNextEnabled && isFetching && (
          <Flex w={16} h={16} alignItems="center" justifyContent="center">
            <Spinner opacity={0.5} size="xl" />
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default memo(NextPrevImageButtons);
