-- Present risk likelihood/impact as words (Very low…Very high) while storing the
-- number 1–5. Adds `options.labels` to those two fields on the risk definition.
update public.definitions
set config = '{
  "allowedParents": ["risk_group"],
  "fields": [
    {"key":"title","label":"Title","data_type":"text","required":true,"filterable":true,"position":0},
    {"key":"status","label":"Status","data_type":"enum","required":true,"filterable":true,"position":1,
      "options":{"choices":["open","mitigating","accepted","closed"]}},
    {"key":"likelihood","label":"Likelihood","data_type":"number","filterable":true,"position":2,
      "options":{"min":1,"max":5,"labels":["Very low","Low","Medium","High","Very high"]}},
    {"key":"impact","label":"Impact","data_type":"number","filterable":true,"position":3,
      "options":{"min":1,"max":5,"labels":["Very low","Low","Medium","High","Very high"]}},
    {"key":"category","label":"Category","data_type":"text","filterable":true,"position":4},
    {"key":"summary","label":"Summary","data_type":"richtext","position":5}
  ]
}'::jsonb
where key = 'risk';
