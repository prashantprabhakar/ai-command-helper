const { LangGraph } = require('./langgraph');
const { analyzeIntent } = require('./agents/intentAgent');
const { generateCommand } = require('./agents/commandAgent');
const { validateSafety } = require('./agents/safetyAgent');
const { generateExplanation } = require('./agents/explainAgent');
const { reviewCommand } = require('./agents/selfCriticAgent');
const { askYesNo } = require('./tools/prompt');

const pipeline = new LangGraph();
const debug = !!process.env.AI_CMD_DEBUG;

pipeline.add("intent", async (state) => {
  const intentResult = await analyzeIntent({ query: state.query });

  return {
    state: { ...state, ...intentResult },
    next: "command"
  };
});

pipeline.add("command", async (state) => {
  const commandResult = await generateCommand({
    intent: state.intent,
    query: state.query,
    context: state.context,
    platform: state.platform,
    shell: state.shell,
  });

  return {
    state: { ...state, ...commandResult },
    next: "critic"
  };
});

pipeline.add("critic", async (state) => {
  const criticResult = await reviewCommand({
    command: state.command,
    query: state.query,
    platform: state.platform,
    shell: state.shell,
  });

  return {
    state: { ...state, ...criticResult },
    next: "safety"
  };
});

pipeline.add("safety", async (state) => {
  const safetyResult = await validateSafety({ command: state.command });

  if (safetyResult.risky) {
    return {
      state: { ...state, ...safetyResult },
      next: "confirm"
    };
  }

  return {
    state: { ...state, ...safetyResult },
    next: state.explain ? "explain" : null
  };
});

pipeline.add("confirm", async (state) => {
  const approved = await askYesNo("\n⚠ Command may be unsafe. Run anyway? (y/n) ");

  if (!approved) {
    return {
      state: { ...state, cancelled: true },
      next: null
    };
  }

  return {
    state,
    next: state.explain ? "explain" : null
  };
});

pipeline.add("explain", async (state) => {
  const explanationResult = await generateExplanation({
    command: state.command
  });

  return {
    state: { ...state, ...explanationResult },
    next: null
  };
});

async function runPipeline({ query, platform = process.platform, shell, explain = false }) {
  return pipeline.run({ query, platform, shell, explain });
}

module.exports = {
  runPipeline,
};
