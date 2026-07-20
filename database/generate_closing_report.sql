-- Supabase SQL function to generate a closing report for a given shift.
-- This function should be added to your Supabase project via the SQL Editor.

create or replace function generate_closing_report(p_shift_id text)
returns table (
    gross_sales numeric,
    net_sales numeric,
    product_sales numeric,
    delivery_revenue numeric,
    total_discounts numeric,
    total_orders bigint,
    completed_orders bigint,
    cancelled_orders bigint,
    application_orders bigint,
    cash_total numeric,
    card_total numeric,
    bank_transfer_total numeric,
    application_total numeric,
    other_payments_total numeric
)
language sql
as $$
select
    coalesce(sum((data->>'total')::numeric), 0) as gross_sales,

    coalesce(sum((data->>'total')::numeric - (data->'discount'->>'amount')::numeric), 0) as net_sales,

    coalesce(sum((data->>'subtotal')::numeric), 0) as product_sales,

    coalesce(sum((data->>'deliveryFee')::numeric), 0) as delivery_revenue,

    coalesce(sum((data->'discount'->>'amount')::numeric), 0) as total_discounts,

    count(*) as total_orders,

    count(*) filter (where data->>'status' = 'delivered' or data->>'status' = 'received') as completed_orders,

    count(*) filter (where data->>'status' = 'cancelled') as cancelled_orders,

    count(*) filter (where data->>'source' != 'restaurant_pos') as application_orders,
    
    coalesce(sum((data->>'total')::numeric) filter (where data->'payment'->>'method' = 'cash'), 0) as cash_total,

    coalesce(sum((data->>'total')::numeric) filter (where data->'payment'->>'method' = 'card'), 0) as card_total,

    coalesce(sum((data->>'total')::numeric) filter (where data->'payment'->>'method' = 'bank_transfer'), 0) as bank_transfer_total,

    coalesce(sum((data->>'total')::numeric) filter (where data->>'source' != 'restaurant_pos'), 0) as application_total,

    coalesce(sum((data->>'total')::numeric) filter (where data->'payment'->>'method' in ('vodafone_cash', 'instapay')), 0) as other_payments_total

from
    app_orders
where
    data->>'shiftId' = p_shift_id
    and data->>'status' not in ('cancelled', 'refunded');
$$;
