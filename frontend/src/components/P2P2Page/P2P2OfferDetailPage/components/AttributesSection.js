import React, { useMemo } from 'react';
import {
  SectionCard,
  SectionHeading,
  SectionTitle,
  AttributesTable,
  AttributeCard,
  AttributeKey,
  AttributeValue,
  EmptyState
} from '../styles';
import { extractAttributes } from '../utils/formatters';

const AttributesSection = ({ offer }) => {
  const attributes = useMemo(() => {
    if (!offer?.offeredAssets) return [];
    const assetWithTraits = offer.offeredAssets.find((asset) => asset?.metadata?.attributes?.length);
    return extractAttributes(assetWithTraits);
  }, [offer]);

  if (!offer) return null;

  return (
    <SectionCard>
      <SectionHeading>
        <SectionTitle>Featured Attributes</SectionTitle>
      </SectionHeading>
      {attributes.length > 0 ? (
        <AttributesTable>
          {attributes.map((attribute) => (
            <AttributeCard key={attribute.id}>
              <AttributeKey>{attribute.key}</AttributeKey>
              <AttributeValue>{attribute.value}</AttributeValue>
            </AttributeCard>
          ))}
        </AttributesTable>
      ) : (
        <EmptyState>No trait data provided.</EmptyState>
      )}
    </SectionCard>
  );
};

export default AttributesSection;
