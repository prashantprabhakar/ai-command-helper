const { LangGraph } = require('./langgraph');
const { analyzeIntent } = require('./agents/intentAgent');
const { generateCommand } = require('./agents/commandAgent');
const { validateSafety } = require('./agents/safetyAgent');
const { generateExplanation } = require('./agents/explainAgent');

const pipeline = new LangGraph();
const debug = !!process.env.AI_CMD_DEBUG;

pipeline.use(async (state) => {
  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[ai-cmd] pipeline: running intent analysis');
  }
  const intentResult = await analyzeIntent({ query: state.query });
  return { ...state, ...intentResult };
});

pipeline.use(async (state) => {
  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[ai-cmd] pipeline: generating command');
  }
  const commandResult = await generateCommand({
    intent: state.intent,
    query: state.query,
    context: state.context,
    platform: state.platform,
  });
  return { ...state, ...commandResult };
});

pipeline.use(async (state) => {
  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[ai-cmd] pipeline: validating safety');
  }
  const safetyResult = await validateSafety({ command: state.command });
  return { ...state, ...safetyResult };
});

pipeline.use(async (state) => {
  if (debug) {
    // eslint-disable-next-line no-console
    console.log('[ai-cmd] pipeline: generating explanation');
  }
  const explanationResult = await generateExplanation({ command: state.command });
  return { ...state, ...explanationResult };
});

async function runPipeline({ query }) {
  return pipeline.run({ query, platform: process.platform });
}

module.exports = {
  runPipeline,
};
