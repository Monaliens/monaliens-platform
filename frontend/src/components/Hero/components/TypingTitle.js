import React from 'react';
import { Title, Cursor } from '../styles';

// Component for displaying typing title with cursor
const TypingTitle = ({ currentTitle, showTitleCursor }) => {
  return (
    <Title>
      {currentTitle}
      {showTitleCursor && <Cursor />}
    </Title>
  );
};

export default TypingTitle; 