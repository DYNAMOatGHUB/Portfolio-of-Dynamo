// The 50-query live benchmark (eval/live_queries.jsonl) and the three recorded runs (eval/fixtures/*.jsonl)
// from github.com/DYNAMOatGHUB/SLM-Router, measured on Linux x86_64 with an RTX 5070 on 12 October 2026.
// Replies are verbatim, including Mistral's leading space; latency is rounded to the millisecond.

export type LiveQuery = { query: string; tool: string; args: Record<string, string | number> };
export type Run = { id: string; runtime: string; model: string; replies: [string, number][] };

const add = (a: number, b: number, q?: string): LiveQuery => ({ query: q ?? `Add ${a} and ${b}`, tool: 'add', args: { a, b } });
const weather = (city: string, q: string): LiveQuery => ({ query: q, tool: 'get_weather', args: { city, unit: 'c' } });
const search = (q: string, limit: number): LiveQuery => ({ query: `Search ${q}, limit ${limit}`, tool: 'search', args: { q, limit } });
const alarm = (h: number): LiveQuery => ({ query: `Set alarm for ${h}:${h + 10} labelled event${h}`, tool: 'set_alarm', args: { hour: h, minute: h + 10, label: `event${h}` } });

export const QUERIES: LiveQuery[] = [
  add(2, 3), add(0, 0), add(4, 9), add(17, 25), add(100, 1), add(8, 13), add(12, 5), add(42, 58), add(1, 999), add(123, 456),
  add(6, 7, 'What is 6 plus 7?'), add(30, 40, 'What is 30 plus 40?'), add(5, 10, 'Sum 5 and 10'), add(99, 1, 'Sum 99 and 1'), add(11, 22, 'Compute 11 + 22'),
  ...['Pune', 'Delhi', 'Mumbai', 'Chennai', 'Kolkata'].map((c) => weather(c, `Get weather in ${c} in c`)),
  ...['Jaipur', 'Hyderabad', 'Bengaluru', 'Nagpur', 'Surat'].map((c) => weather(c, `Weather for ${c}, c units`)),
  ...(['Python', 'agents', 'Pune', 'solar', 'maps', 'books', 'trains', 'music', 'science', 'recipes'] as const).map((q, i) => search(q, i + 1)),
  ...Array.from({ length: 15 }, (_, i) => alarm(i + 1)),
];

export const RUNS: Run[] = [
  {
    id: 'llama3', runtime: 'Ollama 0.34, GPU', model: 'llama3:8b Q4_0',
    replies: [
      ['ACTION: add(2, 3)', 2167], ['ACTION: add(0, 0)', 93], ['ACTION: add(4, 9)', 98], ['ACTION: add(17, 25)', 90], ['ACTION: add(100, 1)', 93],
      ['ACTION: add(8, 13)', 87], ['ACTION: add(12, 5)', 89], ['ACTION: add(42, 58)', 89], ['ACTION: add(1, 999)', 87], ['ACTION: add(123, 456)', 91],
      ['ACTION: add(6, 7)', 88], ['ACTION: add(30, 40)', 90], ['ACTION: add(5, 10)', 91], ['ACTION: add(99, 1)', 89], ['ACTION: add(11, 22)', 88],
      ['ACTION: get_weather("Pune", "c")', 105], ['ACTION: get_weather(city="Delhi", unit="c")', 121], ['ACTION: get_weather("Mumbai", "c")', 104],
      ['ACTION: get_weather("Chennai", "c")', 105], ['ACTION: get_weather("Kolkata", "c")', 104], ['ACTION: get_weather(city="Jaipur", unit="c")', 120],
      ['ACTION: get_weather(city="Hyderabad", unit="c")', 120], ['ACTION: get_weather(city="Bengaluru", unit="c")', 135], ['ACTION: get_weather("Nagpur", "c")', 113],
      ['ACTION: get_weather(city="Surat", unit="c")', 121],
      ['ACTION: search(q="Python", limit=1)', 106], ['ACTION: search(q="agents", limit=2)', 106], ['ACTION: search(q="Pune", limit=3)', 115],
      ['ACTION: search("solar", 4)', 97], ['ACTION: search(q="maps", limit=5)', 106], ['ACTION: search(q="books", limit=6)', 105],
      ['ACTION: search(q="trains", limit=7)', 114], ['ACTION: search(q="music", limit=8)', 108], ['ACTION: search(q="science", limit=9)', 108],
      ['ACTION: search(q="recipes", limit=10)', 112],
      ['ACTION: set_alarm(hour=1, minute=11, label="event1")', 157], ['ACTION: set_alarm(hour=2, minute=12, label="event2")', 152],
      ['ACTION: set_alarm(3, 13, "event3")', 128], ['ACTION: set_alarm(hour=4, minute=14, label="event4")', 152],
      ['ACTION: set_alarm(5, 15, "event5")', 129], ['ACTION: set_alarm(hour=6, minute=16, label="event6")', 154],
      ['ACTION: set_alarm(hour=7, minute=17, label="event7")', 153], ['ACTION: set_alarm(hour=8, minute=18, label="event8")', 154],
      ['ACTION: set_alarm(hour=9, minute=19, label="event9")', 153], ['ACTION: set_alarm(hour=10, minute=20, label="event10")', 156],
      ['ACTION: set_alarm(hour=11, minute=21, label="event11")', 151], ['ACTION: set_alarm(hour=12, minute=22, label="event12")', 154],
      ['ACTION: set_alarm(hour=13, minute=23, label="event13")', 153], ['ACTION: set_alarm(hour=14, minute=24, label="event14")', 152],
      ['ACTION: set_alarm(hour=15, minute=25, label="event15")', 153],
    ],
  },
  {
    id: 'mistral', runtime: 'Ollama 0.34, GPU', model: 'mistral 7.2B Q4_K_M',
    replies: [
      [' ACTION: add(a=2, b=3)', 3170], [' ACTION: add(a=0, b=0)', 3452], [' ACTION: add(a=4, b=9)', 116], [' ACTION: add(a=17, b=25)', 134], [' ACTION: add(a=100, b=1)', 131],
      [' ACTION: add(a=8, b=13)', 121], [' ACTION: add(a=12, b=5)', 123], [' ACTION: add(a=42, b=58)', 128], [' ACTION: add(a=1, b=999)', 131], [' ACTION: add(a=123, b=456)', 145],
      [' ACTION: add(a=6, b=7)', 114], [' ACTION: add(a=30, b=40)', 128], [' ACTION: add(a=5, b=10)', 122], [' ACTION: add(a=99, b=1)', 120], [' ACTION: add(a=11, b=22)', 130],
      [' ACTION: get_weather(Pune, "c")', 121], [' ACTION: get_weather(Delhi, "c")', 119], [' ACTION: get_weather("Mumbai", "c")', 128],
      [' ACTION: get_weather("Chennai", "c")', 138], [' ACTION: get_weather("Kolkata", "c")', 128], [' ACTION: get_weather("Jaipur","c")', 130],
      [' ACTION: get_weather("Hyderabad","c")', 119], [' ACTION: get_weather(city="Bengaluru", unit="c")', 160], [' ACTION: get_weather(city="Nagpur", unit="c")', 154],
      [' ACTION: get_weather(city="Surat", unit="c")', 147],
      [' ACTION: search(q="Python", limit=1)', 119], [' ACTION: search(q="agents", limit=2)', 122], [' ACTION: search(q="Pune", limit=3)', 122],
      [' ACTION: search(q="solar", limit=4)', 120], [' ACTION: search(q="maps", limit=5)', 114], [' ACTION: search(q="books", limit=6)', 112],
      [' ACTION: search(q="trains", limit=7)', 122], [' ACTION: search(q="music", limit=8)', 121], [' ACTION: search(q="science", limit=9)', 112],
      [' ACTION: search(q="recipes", limit=10)', 128],
      [' ACTION: set_alarm(1, 11, "event1")', 154], [' ACTION: set_alarm(2, 12, "event2")', 153], [' ACTION: set_alarm(3, 13, "event3")', 154],
      [' ACTION: set_alarm(4, 14, "event4")', 154], [' ACTION: set_alarm(5, 15, "event5")', 152], [' ACTION: set_alarm(6, 16, "event6")', 153],
      [' ACTION: set_alarm(7, 17, "event7")', 151], [' ACTION: set_alarm(8, 18, "event8")', 157], [' ACTION: set_alarm(9, 19, "event9")', 152],
      [' ACTION: set_alarm(10, 20, "event10")', 171], [' ACTION: set_alarm(11, 21, "event11")', 170], [' ACTION: set_alarm(12, 22, label="event12")', 177],
      [' ACTION: set_alarm(13, 23, "event13")', 168], [' ACTION: set_alarm(14, 24, label="event14")', 183], [' ACTION: set_alarm(15, 25, label="event15")', 175],
    ],
  },
  {
    id: 'llamacpp', runtime: 'llama.cpp b11565, CPU only', model: 'mistral 7B Q4_K_M',
    replies: [
      [' ACTION: add(a=2, b=3)', 1272], [' ACTION: add(a=0, b=0)', 1171], [' ACTION: add(a=4, b=9)', 1297], [' ACTION: add(a=17, b=25)', 1376], [' ACTION: add(a=100, b=1)', 1416],
      [' ACTION: add(a=8, b=13)', 1395], [' ACTION: add(a=12, b=5)', 1329], [' ACTION: add(a=42, b=58)', 1385], [' ACTION: add(a=1, b=999)', 1355], [' ACTION: add(a=123, b=456)', 1631],
      [' ACTION: add(a=6, b=7)', 1357], [' ACTION: add(a=30, b=40)', 1466], [' ACTION: add(a=5, b=10)', 1496], [' ACTION: add(a=99, b=1)', 1282], [' ACTION: add(a=11, b=22)', 1476],
      [' ACTION: get_weather(city="Pune", unit="c")', 1580], [' ACTION: get_weather(Delhi, "c")', 1068], [' ACTION: get_weather("Mumbai", "c")', 1209],
      [' ACTION: get_weather("Chennai", "c")', 1246], [' ACTION: get_weather("Kolkata", "c")', 1178], [' ACTION: get_weather("Jaipur","c")', 1241],
      [' ACTION: get_weather(city="Hyderabad", unit="c")', 1404], [' ACTION: get_weather(city="Bengaluru", unit="c")', 1479], [' ACTION: get_weather(city="Nagpur", unit="c")', 1377],
      [' ACTION: get_weather(city="Surat", unit="c")', 1339],
      [' ACTION: search(q="Python", limit=1)', 1143], [' ACTION: search(q="agents", limit=2)', 1108], [' ACTION: search(q="Pune", limit=3)', 1106],
      [' ACTION: search(q="solar", limit=4)', 1111], [' ACTION: search(q="maps", limit=5)', 1037], [' ACTION: search(q="books", limit=6)', 1026],
      [' ACTION: search(q="trains", limit=7)', 1098], [' ACTION: search(q="music", limit=8)', 1104], [' ACTION: search(q="science", limit=9)', 1026],
      [' ACTION: search(q="recipes", limit=10)', 1182],
      [' ACTION: set_alarm(1, 11, "event1")', 1396], [' ACTION: set_alarm(2, 12, "event2")', 1433], [' ACTION: set_alarm(3, 13, "event3")', 1408],
      [' ACTION: set_alarm(4, 14, "event4")', 1439], [' ACTION: set_alarm(5, 15, "event5")', 1447], [' ACTION: set_alarm(6, 16, "event6")', 1419],
      [' ACTION: set_alarm(7, 17, "event7")', 1458], [' ACTION: set_alarm(8, 18, "event8")', 1434], [' ACTION: set_alarm(9, 19, "event9")', 1393],
      [' ACTION: set_alarm(10, 20, "event10")', 1634], [' ACTION: set_alarm(11, 21, "event11")', 1624], [' ACTION: set_alarm(12, 22, "event12")', 1627],
      [' ACTION: set_alarm(13, 23, "event13")', 1606], [' ACTION: set_alarm(14, 24, label="event14")', 1656], [' ACTION: set_alarm(15, 25, label="event15")', 1651],
    ],
  },
];
