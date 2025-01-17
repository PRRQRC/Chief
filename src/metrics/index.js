import {application, Router} from 'express';
import * as client from 'prom-client';
import {ALLOWED_CAPABILITIES} from '../ws/handler/capabilities.js';
import {gatherBrandsStats, gatherCapabilitiesStats} from '../ws/util/statsUtil.js';
import {COLLECT_NODE_METRICS} from '../constants.js';

const {chief} = application;
const router = new Router();

const register = new client.Registry();

if (Boolean(COLLECT_NODE_METRICS)) client.collectDefaultMetrics({register});
register.registerMetric(new client.Counter({
    name: 'websocket_messages_in_total',
    help: 'The amount of messages sent to the websocket server on this instance',
    collect() {
        this.reset();
        this.inc(chief.stats.messagesIn);
    }
}));
register.registerMetric(new client.Counter({
    name: 'websocket_messages_out_total',
    help: 'The amount of messages sent by the websocket server on this instance',
    collect() {
        this.reset();
        this.inc(chief.stats.messagesOut);
    }
}));
register.registerMetric(new client.Gauge({
    name: 'valid_connections',
    help: 'The amount of currently active connections that have sent at least one valid message to the websocket server on this instance',
    collect() {
        this.set([...chief.clients.values()].filter((client) => client.sentValidMessage).length);
    }
}));
register.registerMetric(new client.Gauge({
    name: 'websocket_connections',
    help: 'The amount of currently active connections to the websocket server on this instance',
    collect() {
        this.set(chief.clients.size);
    }
}));
register.registerMetric(new client.Gauge({
    name: 'websocket_capabilities',
    help: 'The amount of currently active connections to the websocket server on this instance',
    labelNames: ['capability'],
    collect() {
        const capabilities = gatherCapabilitiesStats(chief);
        for (const capability of ALLOWED_CAPABILITIES) {
            this.labels({capability}).set(capabilities[capability]);
        }
    }
}));
register.registerMetric(new client.Gauge({
    name: 'websocket_brands',
    help: 'The amount of currently active connections to the websocket server on this instance, per brand',
    labelNames: ['author', 'name', 'version'],
    collect() {
        this.reset();

        const brands = gatherBrandsStats(chief);
        for (const [author, a] of Object.entries(brands)) {
            for (const [name, n] of Object.entries(a)) {
                for (const [version, v] of Object.entries(n)) {
                    this.labels({author, name, version}).set(v);
                }
            }
        }
    }
}));

router.get('/', async (req, res) => {
    res.type('text/plain').send(await register.metrics());
});

export default router;
