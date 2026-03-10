/**
 * Very small, local implementation of a "LangGraph"-style pipeline.
 *
 * This is not a full LangGraph framework, but it mimics the core concept:
 * nodes (agents) are executed in order and each node can transform the workflow state.
 */

class LangGraph {
  constructor(nodes = []) {
    this.nodes = nodes;
  }

  use(node) {
    this.nodes.push(node);
    return this;
  }

  async run(initialState) {
    let state = { ...initialState };
    for (const node of this.nodes) {
      state = await node(state);
    }
    return state;
  }
}

module.exports = {
  LangGraph,
};
