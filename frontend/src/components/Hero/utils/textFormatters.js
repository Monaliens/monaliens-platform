import React from 'react';
import { TEXT_HIGHLIGHT } from '../data/heroContent';

// Find the index of the special keyword in text
export const findKeywordIndex = (text, keyword) => {
  return text.toLowerCase().indexOf(keyword.toLowerCase());
};

// Split text into parts around the keyword
export const splitTextAroundKeyword = (fullText, keyword) => {
  const keywordIndex = findKeywordIndex(fullText, keyword);
  
  if (keywordIndex === -1) {
    return { beforeKeyword: fullText, keyword: '', afterKeyword: '' };
  }
  
  return {
    beforeKeyword: fullText.substring(0, keywordIndex),
    keyword: fullText.substring(keywordIndex, keywordIndex + keyword.length),
    afterKeyword: fullText.substring(keywordIndex + keyword.length)
  };
};

// Determine which part of the text should be visible during typing
export const getVisibleTextParts = (fullText, currentText, keyword) => {
  const { beforeKeyword } = splitTextAroundKeyword(fullText, keyword);
  const keywordIndex = findKeywordIndex(fullText, keyword);
  
  if (currentText.length <= keywordIndex) {
    // Still typing before the keyword
    return {
      beforePart: currentText,
      keywordPart: '',
      afterPart: '',
      isKeywordVisible: false
    };
  } else if (currentText.length <= keywordIndex + keyword.length) {
    // Typing the keyword
    return {
      beforePart: beforeKeyword,
      keywordPart: currentText.substring(keywordIndex),
      afterPart: '',
      isKeywordVisible: true
    };
  } else {
    // Typing after the keyword
    return {
      beforePart: beforeKeyword,
      keywordPart: keyword,
      afterPart: currentText.substring(keywordIndex + keyword.length),
      isKeywordVisible: true
    };
  }
};

// Format subtitle with highlighted keyword
export const formatSubtitleWithHighlight = (
  currentText, 
  fullText, 
  HighlightComponent, 
  GlitchTextComponent,
  isComplete = false
) => {
  const keyword = TEXT_HIGHLIGHT.keyword;
  const parts = getVisibleTextParts(fullText, currentText, keyword);
  
  if (!parts.isKeywordVisible) {
    return parts.beforePart;
  }
  
  return (
    <>
      {parts.beforePart}
      <HighlightComponent>
        {isComplete && parts.keywordPart === keyword ? (
          <GlitchTextComponent text={keyword} />
        ) : (
          parts.keywordPart
        )}
      </HighlightComponent>
      {parts.afterPart}
    </>
  );
}; 