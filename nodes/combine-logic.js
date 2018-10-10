module.exports = function (RED) {
    class CombineLogicNode {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.msgs = {};
            this.timeouts = {};

            this.topic = config.topic || '';
            this.operator = config.operator;
            this.distinction = config.distinction || 'topic';
            this.defer = parseInt(config.defer, 10) || 0;
            this.timeout = parseInt(config.timeout, 10) || 0;

            this.on('input', this.handleMsg);
        }

        handleMsg(incoming) {
            const key = incoming[this.distinction];
            this.msgs[key] = Boolean(incoming.payload);
            const outgoing = this.combine();

            if (this.defer) {
                this.sendDeferred(outgoing);
            } else {
                if (outgoing.payload) {
                    this.status({fill: 'blue', shape: 'dot', text: 'true (' + Object.keys(this.msgs).length + ')'});
                } else {
                    this.status({fill: 'grey', shape: 'ring', text: 'false (' + Object.keys(this.msgs).length + ')'});
                }
                this.send(outgoing);
            }

            if (this.timeout) {
                clearTimeout(this.timeouts[key]);
                this.timeouts[key] = setTimeout(() => {
                    this.remove(key);
                }, this.timeout);
            }
        }

        remove(key) {
            delete this.msgs[key];
            const msg = this.combine();

            this.send(msg);
        }

        sendDeferred(msg) {
            this.msgDeferred = msg;
            if (!this.sendTimeout) {
                this.sendTimeout = setTimeout(() => {
                    this.send(this.msgDeferred);
                    if (this.msgDeferred.payload) {
                        this.status({fill: 'blue', shape: 'dot', text: 'true (' + Object.keys(this.msgs).length + ')'});
                    } else {
                        this.status({fill: 'grey', shape: 'ring', text: 'false (' + Object.keys(this.msgs).length + ')'});
                    }
                    this.sendTimeout = null;
                }, this.defer);
            }
        }

        combine() {
            const topics = Object.keys(this.msgs);
            const payloads = Object.values(this.msgs);

            const combine = {
                topics: this.distinction === 'topic' ? topics : undefined,
                messages: this.distinction === '_msgid' ? topics : undefined,
                and: payloads.reduce((pv, cv) => pv && cv),
                or: this.or(payloads),
                xor: payloads.reduce((pv, cv) => pv ^ cv)
            };

            combine.nand = !combine.and;
            combine.nor = !combine.or;
            combine.xnor = !combine.xor;

            return Object.assign({
                topic: this.topic,
                payload: combine[this.operator]
            }, combine);
        }

        or(array) {
            for (let i = 0, len = array.length; i < len; i++) {
                if (array[i]) {
                    return true;
                }
            }
        }
    }

    RED.nodes.registerType('combine-logic', CombineLogicNode);
};
