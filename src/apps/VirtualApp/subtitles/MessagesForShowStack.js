import mqtt from '../../../shared/mqtt';

const MSGS_TYPES = {
  subtitle: 'subtitle',
  workshop: 'workshop'
};

export class MessagesForShowStack {
  constructor(lang) {
    this.lang = lang;
    this.msgs = [];
  }

  push(data, type) {
    const forRemove = this.msgs.findIndex(m => m.type === type);
    (forRemove > -1) && this.msgs.splice(forRemove, 1);
    const m = data.message;
    if (data.message === 'clear') {
      return;
    }
    this.msgs.push({ data, addedAt: Date.now(), type });
  }

  pushSubtitles(msg) {
    this.push(JSON.parse(msg.toString()), MSGS_TYPES.subtitle);
  }

  pushWorkshop(msg) {
    this.push(msg, MSGS_TYPES.workshop);
  }

  last() {
    return this.msgs.filter(m => m.msg !== 'clear').sort((a, b) => b.addedAt - a.addedAt)[0];
  }
};
