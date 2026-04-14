const { pipeline } = require('@xenova/transformers');
const CONFIG = require("./config");

/**
 * @function synthesize
 * @async
 * @description
 * Executes a generative text-to-text (T5/BART-style) operation to produce a 
 * refined response based on a final prompt. Unlike extractive methods, this 
 * function uses generative reasoning to synthesize new text, making it ideal 
 * for summarization, translation, or complex reasoning tasks.
 *
 * The function supports lazy initialization: if a preloaded pipeline instance 
 * is not provided via the `synthesizer` parameter, it will automatically 
 * initialize one using the specified or default model configuration.
 *
 * @param {string} finalPrompt
 * The fully constructed prompt or instruction to be processed by the model.
 *
 * @param {Object} options
 * Configuration object for the generation process.
 *
 * @param {number} [options.max_new_tokens=250]
 * The maximum length of the generated sequence. Controls the verbosity of the output.
 *
 * @param {number} [options.temperature=0.2]
 * Sampling temperature. Lower values (near 0) result in more deterministic, 
 * factual, and repetitive output, while higher values increase creativity.
 *
 * @param {*} [options.synthesizer]
 * Preloaded @xenova/transformers text2text-generation pipeline instance. 
 * If null, the pipeline is initialized on-demand.
 *
 * @param {string} [options.text2textModel=CONFIG.text2textModel]
 * Model name used to initialize the pipeline if `synthesizer` is not provided.
 *
 * @returns {Promise<Object[]>}
 * Resolves to an array of generation objects (typically containing a 
 * `generated_text` property).
 *
 * @example
 * const result = await synthesize(
 * "Summarize the following: Biofilms are complex clusters of microbes...",
 * { temperature: 0.1 }
 * );
 * console.log(result[0].generated_text);
 *
 * @notes
 * - This process is **generative**; the model may use vocabulary not present 
 * in the input prompt.
 * - Ideal for "Chain of Thought" reasoning or final response formatting.
 * - Heavily dependent on the `max_new_tokens` limit to prevent runaway generation.
 *
 * @throws {Error}
 * Throws if the model fails to load or the inference pipeline encounters an error.
 */
let model;
const synthesize = async (
  prompt,
  { 
    min_length = 0,               // Allow short, concise answers
    max_length = 200,
    max_new_tokens = max_length,
    temperature = 0.3,            // Keep it factual
    do_sample = true,            // Greedy search is safer for facts
    repetition_penalty = 1.2,     // Prevents the model from getting stuck in a loop
    length_penalty = 1,           // This pushes the model to be more verbose.
    num_beams = 5,                // Allows the model to "think" through options
    no_repeat_ngram_size = 3,     // Helps the model move from one fact to the next
    early_stopping = true,       // Stops as soon as the answer is complete if true
    stopping_criteria = null,     // Stop sequence helps prevent the model from "continuing" the conversation
    synthesizer,
    text2textModel,
    ...other
  }
) => {
  // Init question text2text engine if needed.
  synthesizer || (
    synthesizer = model || (model = await createSynthesizer(text2textModel))
  );

  // Compute text generation.
  const result = await synthesizer(prompt, {
    min_length,
    max_length: max_new_tokens,
    max_new_tokens,
    temperature,
    do_sample,
    repetition_penalty,
    length_penalty,
    num_beams,
    no_repeat_ngram_size,
    early_stopping,
    stopping_criteria,
    ...other
  });

  return result[0].generated_text;
};

const createSynthesizer = synthesize.createSynthesizer = async text2textModel => (
  await pipeline("text2text-generation", text2textModel || CONFIG.text2textModel)
);

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(synthesize, "synthesize", {
  value: synthesize
}));