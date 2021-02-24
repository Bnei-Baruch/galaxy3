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
    console.log('MessagesForShowStack push', data, type, this.msgs);
    if (data.language !== this.lang && !data.clear) return;

    const forRemove = this.msgs.findIndex(m => m.type === type);
    (forRemove > -1) && this.msgs.splice(forRemove, 1);
    if (data.clear) {
      return;
    }
    this.msgs.push({ message: data.message, addedAt: Date.now(), type });
  }

  pushSubtitles(msg) {
    let data                    = JSON.parse(msg.toString());
    const { language, message } = data;
    if (message === 'on_air') return;

    if (message === 'clear')
      this.push({ clear: true, language }, MSGS_TYPES.subtitle);
    else {
      this.push({ language, message: message.content }, MSGS_TYPES.subtitle);
    }

  }

  pushWorkshop(data) {
    this.push(data, MSGS_TYPES.workshop);
  }

  last() {
    return this.msgs.filter(m => m.msg !== 'clear').sort((a, b) => b.addedAt - a.addedAt)[0];
  }
};
