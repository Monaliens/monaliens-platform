/**
 * Clean MongoDB response by removing internal fields
 */

/**
 * Clean a single document - remove only _id and __v
 */
function cleanDoc(doc) {
  if (!doc) return doc;

  const cleaned = { ...doc };
  delete cleaned._id;
  delete cleaned.__v;

  // Clean nested _id in attributes
  if (cleaned.metadata?.attributes) {
    cleaned.metadata.attributes = cleaned.metadata.attributes.map(attr => ({
      trait_type: attr.trait_type,
      value: attr.value,
    }));
  }

  return cleaned;
}

/**
 * Clean an array of documents
 */
function cleanDocs(docs) {
  if (!Array.isArray(docs)) return docs;
  return docs.map(cleanDoc);
}

module.exports = { cleanDoc, cleanDocs };
