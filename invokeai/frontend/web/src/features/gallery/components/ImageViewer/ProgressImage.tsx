import type { SystemStyleObject } from '@invoke-ai/ui-library';
import { Image } from '@invoke-ai/ui-library';
import { useAppSelector } from 'app/store/storeHooks';
import { memo, useMemo } from 'react';

const CurrentImagePreview = () => {
  const image = useAppSelector((s) => s.system.denoiseProgress?.image);
  const shouldAntialiasProgressImage = useAppSelector((s) => s.system.shouldAntialiasProgressImage);

  const sx = useMemo<SystemStyleObject>(
    () => ({
      imageRendering: shouldAntialiasProgressImage ? 'auto' : 'pixelated',
    }),
    [shouldAntialiasProgressImage]
  );

  if (!image) {
    return null;
  }

  return (
    <Image
      src={image.dataURL}
      width={image.width}
      height={image.height}
      draggable={false}
      data-testid="progress-image"
      objectFit="contain"
      maxWidth="full"
      maxHeight="full"
      position="absolute"
      borderRadius="base"
      sx={sx}
    />
  );
};

export default memo(CurrentImagePreview);
