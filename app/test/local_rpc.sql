-- local testing only: call any API function by name with JSON arguments (what PostgREST does)
create or replace function public.rpc_call(fn text, args jsonb) returns json language plpgsql as $$
declare a text; r json;
begin
  select string_agg(format('%I => %L%s', key, case when jsonb_typeof(value) = 'string' then value #>> '{}' else value::text end,
                           case when jsonb_typeof(value) in ('object', 'array') then '::jsonb' else '' end), ', ')
    into a from jsonb_each(coalesce(args, '{}'));
  execute format('select to_json(public.%I(%s))', fn, coalesce(a, '')) into r;
  return r;
end $$;
