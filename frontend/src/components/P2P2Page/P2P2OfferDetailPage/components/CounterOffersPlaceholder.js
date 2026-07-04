import React from 'react';
import {
  CounterOffersBlock,
  CounterHeading,
  CounterDescription
} from '../styles';

const CounterOffersPlaceholder = () => (
  <CounterOffersBlock>
    <CounterHeading>Counter Offers</CounterHeading>
    <CounterDescription>
      No counter offers yet. Share the link with interested traders so they can
      respond with their own proposals.
    </CounterDescription>
  </CounterOffersBlock>
);

export default CounterOffersPlaceholder;
