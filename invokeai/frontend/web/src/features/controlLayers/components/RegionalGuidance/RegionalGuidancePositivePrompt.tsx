import { Box, Textarea } from '@invoke-ai/ui-library';
import { useAppDispatch, useAppSelector } from 'app/store/storeHooks';
import { RegionalGuidanceDeletePromptButton } from 'features/controlLayers/components/RegionalGuidance/RegionalGuidanceDeletePromptButton';
import { useEntityIdentifierContext } from 'features/controlLayers/contexts/EntityIdentifierContext';
import { rgPositivePromptChanged } from 'features/controlLayers/store/canvasV2Slice';
import { selectEntityOrThrow } from 'features/controlLayers/store/selectors';
import { PromptOverlayButtonWrapper } from 'features/parameters/components/Prompts/PromptOverlayButtonWrapper';
import { AddPromptTriggerButton } from 'features/prompt/AddPromptTriggerButton';
import { PromptPopover } from 'features/prompt/PromptPopover';
import { usePrompt } from 'features/prompt/usePrompt';
import { memo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export const RegionalGuidancePositivePrompt = memo(() => {
  const entityIdentifier = useEntityIdentifierContext('regional_guidance');
  const prompt = useAppSelector((s) => selectEntityOrThrow(s.canvasV2.present, entityIdentifier).positivePrompt ?? '');
  const dispatch = useAppDispatch();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation();
  const _onChange = useCallback(
    (v: string) => {
      dispatch(rgPositivePromptChanged({ entityIdentifier, prompt: v }));
    },
    [dispatch, entityIdentifier]
  );
  const onDeletePrompt = useCallback(() => {
    dispatch(rgPositivePromptChanged({ entityIdentifier, prompt: null }));
  }, [dispatch, entityIdentifier]);
  const { onChange, isOpen, onClose, onOpen, onSelect, onKeyDown } = usePrompt({
    prompt,
    textareaRef,
    onChange: _onChange,
  });

  return (
    <PromptPopover isOpen={isOpen} onClose={onClose} onSelect={onSelect} width={textareaRef.current?.clientWidth}>
      <Box pos="relative" w="full">
        <Textarea
          id="prompt"
          name="prompt"
          ref={textareaRef}
          value={prompt}
          placeholder={t('parameters.positivePromptPlaceholder')}
          onChange={onChange}
          onKeyDown={onKeyDown}
          variant="darkFilled"
          paddingRight={30}
          minH={28}
        />
        <PromptOverlayButtonWrapper>
          <RegionalGuidanceDeletePromptButton onDelete={onDeletePrompt} />
          <AddPromptTriggerButton isOpen={isOpen} onOpen={onOpen} />
        </PromptOverlayButtonWrapper>
      </Box>
    </PromptPopover>
  );
});

RegionalGuidancePositivePrompt.displayName = 'RegionalGuidancePositivePrompt';
