/**
 * Very small, local implementation of a "LangGraph"-style pipeline.
 *
 * This is not a full LangGraph framework, but it mimics the core concept:
 * nodes (agents) are executed in order and each node can transform the workflow state.
 */

class LangGraph {
  constructor() {
    this.nodes = {};
    this.startNode = null;
  }

  add(name, node) {
    this.nodes[name] = node;
    if (!this.startNode) {
      this.startNode = name;
    }
    return this;
  }

  async run(initialState) {
    let current = this.startNode;
    let state = { ...initialState };

    while (current) {
      const node = this.nodes[current];
      const result = await node(state);

      state = result.state || state;
      current = result.next;
    }

    return state;
  }
}

module.exports = { LangGraph };
