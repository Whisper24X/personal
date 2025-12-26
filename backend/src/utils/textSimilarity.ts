/**
 * Text Similarity Utilities
 * Provides simple text similarity algorithms for RAG retrieval
 */

/**
 * Tokenize text into words (simple implementation)
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Calculate word frequency map
 */
function getWordFrequency(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return freq;
}

/**
 * Calculate cosine similarity between two texts
 * Returns a value between 0 and 1, where 1 means identical
 */
export function calculateCosineSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0;
  }
  
  const freq1 = getWordFrequency(tokens1);
  const freq2 = getWordFrequency(tokens2);
  
  // Get all unique words from both texts
  const allWords = new Set([...freq1.keys(), ...freq2.keys()]);
  
  // Calculate dot product and magnitudes
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  for (const word of allWords) {
    const count1 = freq1.get(word) || 0;
    const count2 = freq2.get(word) || 0;
    
    dotProduct += count1 * count2;
    magnitude1 += count1 * count1;
    magnitude2 += count2 * count2;
  }
  
  // Calculate cosine similarity
  const denominator = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
  if (denominator === 0) {
    return 0;
  }
  
  return dotProduct / denominator;
}

/**
 * Extract keywords from text (simple implementation)
 * Returns top N most frequent words
 */
export function extractKeywords(text: string, topN: number = 10): string[] {
  const tokens = tokenize(text);
  const freq = getWordFrequency(tokens);
  
  // Sort by frequency and return top N
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

/**
 * Split text into chunks by paragraphs or sentences
 */
function splitIntoChunks(text: string, chunkSize: number = 500): string[] {
  // Split by double newlines (paragraphs) first
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.length <= chunkSize) {
      chunks.push(paragraph.trim());
    } else {
      // If paragraph is too long, split by sentences
      const sentences = paragraph.split(/[.!?]+\s+/);
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= chunkSize) {
          currentChunk += sentence + '. ';
        } else {
          if (currentChunk) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence + '. ';
        }
      }
      
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
    }
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * Find most similar chunks in content based on query
 * Returns top K chunks sorted by similarity
 */
export function findSimilarChunks(
  content: string,
  query: string,
  topK: number = 5
): Array<{ chunk: string; similarity: number }> {
  const chunks = splitIntoChunks(content);
  const results: Array<{ chunk: string; similarity: number }> = [];
  
  for (const chunk of chunks) {
    const similarity = calculateCosineSimilarity(chunk, query);
    results.push({ chunk, similarity });
  }
  
  // Sort by similarity (descending) and return top K
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
    .filter(result => result.similarity > 0); // Filter out zero similarity
}

/**
 * Calculate text similarity score (0-1)
 * Higher score means more similar
 */
export function calculateSimilarityScore(text1: string, text2: string): number {
  return calculateCosineSimilarity(text1, text2);
}

