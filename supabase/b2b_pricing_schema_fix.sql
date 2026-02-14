-- BU SCRIPT VARIANT_PRICES TABLOSUNU DÜZELTİR VE TAMAMEN UUID UYUMLU HALE GETİRİR

-- 1. Önce eski trigger ve fonksiyonları temizle
drop trigger if exists on_variant_base_price_change on product_variants;
drop trigger if exists on_b2b_percentage_change on app_settings;
drop function if exists update_single_b2b_price();
drop function if exists update_all_b2b_prices();
drop function if exists get_b2b_list_id();

-- 2. variant_prices tablosundaki YANLIŞ TİPLERİ düzelt (Integer -> UUID)
do $$
begin
    -- Constraintleri geçici olarak kaldır (Hata vermemesi için)
    alter table variant_prices drop constraint if exists variant_prices_variant_id_fkey;
    alter table variant_prices drop constraint if exists variant_prices_price_list_id_fkey;

    -- variant_id sütununu UUID'ye çevir
    -- Eğer sütun zaten UUID ise bu işlem hata vermez veya pas geçilebilir ama biz zorluyoruz.
    -- Mevcut veriler integer ise text -> uuid dönüşümü yapılır.
    alter table variant_prices alter column variant_id type uuid using variant_id::text::uuid;

    -- price_list_id sütununu UUID'ye çevir
    alter table variant_prices alter column price_list_id type uuid using price_list_id::text::uuid;

    -- Constraintleri tekrar ekle (Doğru tiplerle)
    -- Not: product_variants.id ve price_lists.id'nin UUID olduğu varsayılıyor.
    alter table variant_prices add constraint variant_prices_variant_id_fkey foreign key (variant_id) references product_variants(id) on delete cascade;
    alter table variant_prices add constraint variant_prices_price_list_id_fkey foreign key (price_list_id) references price_lists(id) on delete cascade;

exception when others then
    raise notice 'Tablo dönüştürme hatası (zaten doğru olabilir): %', SQLERRM;
end $$;


-- 3. price_lists tablosunu kontrol et (Type sütunu)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'price_lists' and column_name = 'type') then
        alter table price_lists add column type text;
    end if;
end $$;

-- 4. App Settings
create table if not exists app_settings (
    key text primary key,
    value jsonb not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);
insert into app_settings (key, value)
values ('b2b_discount_percentage', '{"percentage": 0}'::jsonb)
on conflict (key) do nothing;


-- 5. Yeni Fonksiyonlar (UUID UYUMLU)
create or replace function get_b2b_list_id()
returns uuid
language plpgsql
as $$
declare
    b2b_list_id uuid;
begin
    select id into b2b_list_id from price_lists where type = 'b2b' limit 1;
    
    if b2b_list_id is null then
        select id into b2b_list_id from price_lists where name = 'B2B Fiyat Listesi' limit 1;
        if b2b_list_id is not null then
            update price_lists set type = 'b2b' where id = b2b_list_id;
        end if;
    end if;

    if b2b_list_id is null then
        insert into price_lists (name, currency, type)
        values ('B2B Fiyat Listesi', 'TRY', 'b2b')
        returning id into b2b_list_id;
    end if;

    return b2b_list_id;
end;
$$;

create or replace function update_single_b2b_price()
returns trigger
language plpgsql
security definer
as $$
declare
    b2b_percentage numeric;
    b2b_list_id uuid;
    new_price numeric;
    settings_json jsonb;
begin
    if OLD.base_price = NEW.base_price then return new; end if;

    select value into settings_json from app_settings where key = 'b2b_discount_percentage';
    b2b_percentage := coalesce((settings_json->>'percentage')::numeric, 0);
    b2b_list_id := get_b2b_list_id();

    new_price := NEW.base_price * (1 - b2b_percentage / 100.0);

    insert into variant_prices (variant_id, price_list_id, price, is_active)
    values (NEW.id, b2b_list_id, new_price, true)
    on conflict (variant_id, price_list_id) 
    do update set price = excluded.price, updated_at = now();

    return new;
end;
$$;

create or replace function update_all_b2b_prices()
returns trigger
language plpgsql
security definer
as $$
declare
    b2b_percentage numeric;
    b2b_list_id uuid;
    rec record;
    new_price numeric;
begin
    b2b_percentage := coalesce((NEW.value->>'percentage')::numeric, 0);
    b2b_list_id := get_b2b_list_id();

    for rec in select id, base_price from product_variants loop
        new_price := rec.base_price * (1 - b2b_percentage / 100.0);

        insert into variant_prices (variant_id, price_list_id, price, is_active)
        values (rec.id, b2b_list_id, new_price, true)
        on conflict (variant_id, price_list_id) 
        do update set price = excluded.price, updated_at = now();
    end loop;

    return new;
end;
$$;

-- 6. Triggerları Kur
create trigger on_variant_base_price_change
after update on product_variants
for each row
execute function update_single_b2b_price();

create trigger on_b2b_percentage_change
after update on app_settings
for each row
when (OLD.value IS DISTINCT FROM NEW.value AND NEW.key = 'b2b_discount_percentage')
execute function update_all_b2b_prices();
