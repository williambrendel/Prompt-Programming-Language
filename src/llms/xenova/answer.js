"use strict";

const { pipeline } = require('@xenova/transformers');
const CONFIG = require("./config");

/**
 * @function answer
 * @async
 * @description
 * Executes an extractive question-answering (QA) operation over a provided
 * context. The function uses a transformer-based question-answering pipeline
 * to locate and return the most relevant answer span directly from the
 * supplied context text.
 *
 * The function supports lazy initialization of the QA pipeline: if a
 * preloaded pipeline instance is not provided, it will be created on-demand
 * using the specified model.
 *
 * This is a strictly extractive process — the returned answer must exist
 * verbatim within the context and no generative reasoning or synthesis
 * is performed.
 *
 * @param {string} question
 * Natural language question to be answered.
 *
 * @param {string} context
 * Text passage in which the answer will be searched. The answer must be
 * present as a contiguous span within this context.
 *
 * @param {Object} options
 * Configuration object.
 *
 * @param {*} [options.questionAnswering]
 * Preloaded @xenova/transformers question-answering pipeline instance.
 * If not provided, the pipeline will be initialized automatically.
 *
 * @param {string} [options.questionAnsweringModel=CONFIG.questionAnsweringModel]
 * Model name used to initialize the question-answering pipeline when
 * a preloaded instance is not supplied.
 *
 * @returns {Promise<Object>}
 * Resolves to an object containing the extracted answer span:
 *
 * @returns {string} return.answer
 * Extracted answer text from the context.
 *
 * @returns {number} return.score
 * Confidence score indicating how well the answer matches the question.
 *
 * @returns {number} return.start
 * Character index where the answer span begins in the context.
 *
 * @returns {number} return.end
 * Character index where the answer span ends in the context.
 *
 * @example
 * const result = await answer(
 *   "What issues do biofilms cause?",
 *   "Biofilms reduce heat transfer efficiency and increase corrosion rates.",
 *   {}
 * );
 *
 * console.log(result.answer);
 *
 * @notes
 * - Designed to be used after a retrieval step (e.g., semantic search).
 * - Does not hallucinate or generate new content.
 * - Best suited for fact-grounded, high-precision QA workflows.
 *
 * @throws {Error}
 * Throws if the question-answering pipeline cannot be initialized.
 */
let model;
const answer = async (
  question,
  context,
  {
    questionAnswering,
    questionAnsweringModel,
    topk,
    ...other
  } = {}
) => {

  // Init question answering engine if needed.
  questionAnswering || (
    questionAnswering = model || (model = await createQuestionAnswering(questionAnsweringModel))
  );

  return await questionAnswering(
    question.normalize("NFC").trim(),
    context.normalize("NFC").trim(),
    { topk, ...other }
  );
}

const createQuestionAnswering = answer.createQuestionAnswering = async questionAnsweringModel => (
  await pipeline("question-answering", questionAnsweringModel || CONFIG.questionAnsweringModel)
);

/**
 * @ignore
 * Default export with freezing.
 */
module.exports = Object.freeze(Object.defineProperty(answer, "answer", {
  value: answer
}));