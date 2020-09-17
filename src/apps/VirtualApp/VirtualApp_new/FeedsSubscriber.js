import { Janus } from '../../../lib/janus';

const MAX_USERS_IN_ROOM  = 25;
const sortAndFilterFeeds = (feeds) => feeds
  //.filter(feed => !feed.display.role.match(/^(ghost|guest)$/))
  .sort((a, b) => a.display.timestamp - b.display.timestamp);
let creatingFeed;

class FeedsSubscriber {
  remoteFeed;
  publishers = new Map();

  setRemoteFeed = (remoteFeed) => {
    this.remoteFeed = remoteFeed;
  };

  setMyId = id => this.myId = id;

  setMyPvtId = id => this.myPvtId = id;

  feedById = id => this.publishers.get(id);

  addFeed = p => this.publishers.set(p.id, p);

  getFeeds = () => [...this.publishers.values()];

  // Subscribes selectively to different stream types |subscribeToVideo|, |subscribeToAudio|, |subscribeToData|.
  // This is required to stop and then start only the videos to save bandwidth.
  makeSubscription = async (newPublishers, subscribeToVideo, subscribeToAudio, subscribeToData) => {
    Janus.debug('Got a list of available publishers/feeds:', newPublishers);

    newPublishers = newPublishers
      .map(f => ({ ...f, display: JSON.parse(f.display) }))
      .filter(feed => !feed.display.role.match(/^(1ghost|1guest)$/));

    if (newPublishers.length + this.publishers.size >= MAX_USERS_IN_ROOM)
      throw new Error('oldClient.maxUsersInRoom');

    const subscription = [];
    newPublishers.forEach(feed => {
        const { id, streams } = feed;

        feed.video   = !!streams.find(v => v.type === 'video' && v.codec === 'h264');
        feed.audio   = !!streams.find(a => a.type === 'audio' && a.codec === 'opus');
        feed.data    = !!streams.find(d => d.type === 'data');
        feed.cammute = !feed.video;

        streams.forEach(stream => {
          if (
            (subscribeToVideo && stream.type === 'video' && stream.codec === 'h264') ||
            (subscribeToAudio && stream.type === 'audio' && stream.codec === 'opus') ||
            (subscribeToData && stream.type === 'data')
          ) {
            subscription.push({ feed: id, mid: stream.mid });
          }
        });
      }
    );

    // Add only non yet existing feeds.
    newPublishers
      .filter(feed => !this.publishers.has(feed.id))
      .forEach(this.addFeed);

    if (subscription.length === 0)
      return;

    await this.sendSubscribe(subscription);
  };

  sendSubscribe = async (subscription) => {
    try {
      await this.remoteFeed.send({
        message: { request: 'join', room: this.remoteFeed.room, ptype: 'subscriber', streams: subscription }
      });
    } catch (e) {
      Janus.error('  -- Error attaching plugin...', e);
    }
  };

  subscribeTo = async (subscription) => {
    // New feeds are available, do we need create a new plugin handle first?
    if (this.remoteFeed) {
      return (
        this.remoteFeed.send(
          { message: { request: 'subscribe', streams: subscription } }
        )
      );
    }

    // We don't have a handle yet, but we may be creating one already
    if (creatingFeed) {
      // Still working on the handle
      return setTimeout(() => this.subscribeTo(subscription), 500);
    }

    // We don't creating, so let's do it
    creatingFeed = true;
    try {
      await this.remoteFeed.send({
        message: { request: 'join', room: this.remoteFeed.room, ptype: 'subscriber', streams: subscription }
      });
    } catch (e) {
      Janus.error('  -- Error attaching plugin...', e);
    }
  };

  // Unsubscribe from feeds defined by |ids| (with all streams) and remove it when |onlyVideo| is false.
  // If |onlyVideo| is true, will unsubscribe only from video stream of those specific feeds, keeping those feeds.
  unsubscribeFrom = async (ids, onlyVideo, feeds) => {
    const idsSet      = new Set(ids);
    const unsubscribe = { request: 'unsubscribe', streams: [] };
    this.publishers.filter((id, f) => {
      return idsSet.has(id);
    }).forEach(feed => {
      if (onlyVideo) {
        // Unsubscribe only from one video stream (not all publisher feed).
        // Acutally expecting only one video stream, but writing more generic code.
        feed.streams.filter(stream => stream.type === 'video')
          .map(stream => ({ feed: feed.id, mid: stream.mid }))
          .forEach(stream => unsubscribe.streams.push(stream));
      } else {
        // Unsubscribe the whole feed (all it's streams).
        unsubscribe.streams.push({ feed: feed.id });
        Janus.log('Feed ' + JSON.stringify(feed) + ' (' + feed.id + ') has left the room, detaching');
      }
    });
    // Send an unsubscribe request.
    if (this.remoteFeed !== null && unsubscribe.streams.length > 0) {
      this.remoteFeed.send({ message: unsubscribe });
    }
  };
}

export default FeedsSubscriber;