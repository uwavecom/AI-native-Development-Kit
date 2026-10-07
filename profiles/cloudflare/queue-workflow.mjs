export class CloudflareWorkflowQueue {
  constructor(queue) {
    if (!queue?.send) throw new Error('QUEUE_BINDING_REQUIRED');
    this.queue = queue;
  }

  async enqueue(message, options) {
    if (!message?.workflowId) throw new Error('WORKFLOW_ID_REQUIRED');

    await this.queue.send(message, options);
    return {
      accepted: true,
      workflowId: message.workflowId,
    };
  }
}

export function classifyQueueDelivery(message) {
  return {
    attempts: message?.attempts ?? 1,
    id: message?.id ?? null,
    timestamp: message?.timestamp ?? null,
  };
}
