# rate-limiter

Rate limiters protect APIs from abuse and ensure fair resource distribution. 

Before even thinking about rate limiting strategies, first we should have a very clear idea of the amount of traffic we expect, avg and peak num of requests per client, avg size of incoming requests, max latency that can be tolerated, what our overall infrastructure looks like and when can we expect surges in traffic etc

## Articles Refered :

1. https://betterengineers.substack.com/p/system-design-of-rate-limiter
2. https://blog.wrujel.com/building-rate-limiter-from-scratch-3e697f