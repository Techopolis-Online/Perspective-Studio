# Model Catalog Fetching

This document describes how Perspective Studio fetches models from HuggingFace and Ollama registries.

## Overview

Perspective Studio fetches models from two primary sources:
1. **HuggingFace** - A large repository of machine learning models
2. **Ollama** - A curated collection of optimized local models

## Fetch Limits

### HuggingFace
- **Current Limit**: 10,000 models
- **Previous Limit**: 400 models
- **Rationale**: Allows fetching significantly more models while maintaining reasonable fetch times
- **Pagination**: Uses 100 models per page with 150ms delay between pages to respect API rate limits

### Ollama
- **Current Limit**: All available models (Int.max)
- **Previous Limit**: 60 models
- **Rationale**: Ollama registry is smaller and more curated, so fetching all models is practical

## Model Filtering

All fetched models are automatically filtered to exclude:
- **Gated models**: Models that require approval or special access
- **Private models**: Models that are not publicly accessible
- **Models without downloadable files**: Models missing primary file candidates

This ensures that **only models that can be downloaded without authentication tokens** are included in the catalog.

## Query Sources (HuggingFace)

The service queries multiple sources to ensure diverse model coverage:

1. **Top Downloads**: Most popular models by download count
2. **Trending**: Currently trending models
3. **GGUF Filter**: Models in GGUF format (optimized for local inference)
4. **GGUF Search**: Text search for GGUF models
5. **TheBloke**: Popular quantized model provider
6. **LM Studio**: Curated models from LM Studio
7. **Bartowski**: Community quantized models
8. **Microsoft**: Official Microsoft models
9. **Meta Llama**: Official Meta Llama models
10. **Mistral AI**: Official Mistral models
11. **Google**: Official Google models
12. **Quantized Search**: Text search for quantized models
13. **Recently Updated**: Latest model updates

## Logging

The service provides detailed logging to track fetch progress:

### HuggingFace Logging
- Query start: Current total count
- Page processing: Models processed, new models added, total count
- Query completion: Final count per query
- Pagination status: When queries are exhausted or limits reached

### Ollama Logging
- Registry size: Total models available
- Progress updates: Every 10 models processed
- Final count: Successfully added models

## Performance Considerations

### API Rate Limiting
- 150ms delay between HuggingFace API requests
- Sequential processing of queries to avoid overwhelming the API
- Graceful error handling for individual model failures

### Memory Management
- Deduplication of models across queries using model IDs
- Streaming processing rather than loading all at once
- Models are processed incrementally and added to results as they're validated

### Fetch Time Estimates
- **HuggingFace**: ~5-15 minutes for full catalog (depends on query results)
- **Ollama**: ~2-5 minutes for all models (depends on registry size)
- **Total**: ~7-20 minutes for complete catalog refresh

## Configuration

The fetch limits are configurable in `ModelCatalogService.swift`:

```swift
// In refreshCatalog() method:
let huggingFaceModels = try await fetchHuggingFaceModels(limit: 10_000)
let ollamaModels = try await fetchOllamaModels(limit: Int.max)
```

To adjust limits, modify these values as needed. Setting limits too high may result in:
- Longer fetch times
- Potential API rate limiting
- Larger catalog storage requirements

## Troubleshooting

### Fetch Failures
- Check logs for HTTP error codes
- Verify network connectivity
- Ensure API endpoints are accessible
- Review rate limiting messages

### Missing Models
- Verify model is not gated or private
- Check that model has downloadable files
- Ensure model matches pipeline_tag filter (text-generation)
- Review query parameters for specific sources

### Performance Issues
- Consider reducing fetch limits
- Adjust delay between requests
- Monitor memory usage during fetch
- Check for network latency issues
