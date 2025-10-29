# Testing Guide for Enhanced Model Catalog

This guide describes how to test the enhanced model catalog fetching functionality.

## Prerequisites

- Xcode 15.0 or later
- macOS 13.0 or later
- Network connectivity to HuggingFace and Ollama APIs

## Test Scenarios

### Test 1: Basic Catalog Refresh

**Objective**: Verify that the catalog refresh fetches significantly more models than before.

**Steps**:
1. Open Perspective Studio
2. Navigate to the Model Catalog view
3. Click the "Refresh" button to trigger a catalog refresh
4. Monitor the Console logs (Xcode Debug Console or Console.app)

**Expected Results**:
- Console logs show "HuggingFace: Starting query..." messages for each query source
- Progress logs indicate increasing model counts
- Final log shows "Successfully fetched X models from Hugging Face" where X is significantly higher than 400
- Final log shows "Successfully fetched Y models from Ollama" where Y matches the registry size
- No errors related to gated or private models being rejected
- Total catalog size is significantly larger (previously ~460 models, now 1000+)

### Test 2: Verify No Authentication Required

**Objective**: Confirm that all fetched models can be accessed without authentication tokens.

**Steps**:
1. Complete Test 1 (catalog refresh)
2. Review the Console logs for any "gated" or "private" model rejections
3. Randomly select 5-10 models from the catalog
4. For each model, click to view details
5. Attempt to start a download for each model

**Expected Results**:
- Console logs show models being skipped with message "guard model.privateModel != true, model.gated != true else { continue }"
- No models in the catalog require authentication or approval
- All selected models can initiate downloads without errors
- Download URLs are accessible without authentication tokens

### Test 3: Query Coverage

**Objective**: Verify that the expanded query list provides diverse model coverage.

**Steps**:
1. Complete Test 1 (catalog refresh)
2. Review the Console logs for query execution
3. Check catalog for models from various sources

**Expected Results**:
- Console logs show execution of all 13 query types:
  - top-downloads
  - trending
  - gguf-filter
  - search-gguf
  - thebloke
  - lmstudio
  - bartowski
  - microsoft
  - meta-llama
  - mistralai
  - google
  - search-quantized
  - recently-updated
- Catalog includes models from multiple providers (TheBloke, Microsoft, Meta, Mistral, Google, Bartowski, LM Studio)
- Model variety includes different quantization levels (Q4, Q5, Q6, Q8, FP16)

### Test 4: Performance and Stability

**Objective**: Ensure the enhanced fetching doesn't cause performance issues or crashes.

**Steps**:
1. Start fresh catalog refresh
2. Monitor system resources (Activity Monitor)
3. Let the fetch complete entirely
4. Navigate through the catalog
5. Search and filter models

**Expected Results**:
- Memory usage remains reasonable (< 500 MB during fetch)
- No application crashes or hangs
- Catalog remains responsive during and after fetch
- Search and filtering work correctly with larger catalog
- Catalog persists correctly to disk

### Test 5: Error Handling

**Objective**: Verify graceful error handling when APIs are unavailable or rate-limited.

**Steps**:
1. Temporarily disable network connectivity
2. Attempt catalog refresh
3. Re-enable network
4. Attempt catalog refresh again

**Expected Results**:
- With no network: Appropriate error logged, falls back to cached or placeholder catalog
- With network restored: Successfully fetches models
- No application crashes due to network errors
- Error messages are informative and logged appropriately

## Performance Benchmarks

Expected fetch times (will vary based on network speed and API performance):

- **HuggingFace queries**: ~5-15 minutes for 10,000 model limit
- **Ollama processing**: ~2-5 minutes for full registry
- **Total refresh time**: ~7-20 minutes

Memory usage:
- **During fetch**: 200-500 MB
- **After fetch**: 100-300 MB (with catalog cached)

## Troubleshooting Common Issues

### Issue: Fetch takes too long
**Solution**: 
- Check network connectivity
- Verify HuggingFace API is accessible
- Review Console logs for rate limiting messages
- Consider reducing the limit temporarily for testing

### Issue: Fewer models than expected
**Solution**:
- Check Console logs for query completion messages
- Verify queries aren't being terminated early
- Ensure queries reach their pagination limits
- Check for HTTP errors in logs

### Issue: Memory issues
**Solution**:
- Close other applications
- Ensure sufficient RAM available (8GB+ recommended)
- Check for memory leaks in Activity Monitor
- Review model deduplication logic

## Validation Checklist

- [ ] Catalog refresh completes without errors
- [ ] Significantly more models fetched (1000+)
- [ ] No gated or private models in catalog
- [ ] Multiple query sources executed successfully
- [ ] Models from diverse providers present
- [ ] Download functionality works for random sample
- [ ] Performance remains acceptable
- [ ] Error handling works correctly
- [ ] Catalog persists and loads correctly
- [ ] Search and filtering work with larger catalog

## Reporting Issues

When reporting issues, include:
1. Console logs from the fetch process
2. Number of models fetched from each source
3. Any error messages
4. System specifications (RAM, macOS version)
5. Network conditions
6. Screenshot of catalog view

## Notes

- First fetch after changes may take longer as it's fetching fresh data
- Subsequent fetches may be faster if APIs cache results
- HuggingFace API may rate limit if requests are too frequent
- Some models may fail to process individually but shouldn't stop the entire fetch
