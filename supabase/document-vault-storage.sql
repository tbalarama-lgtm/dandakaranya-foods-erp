-- Document Vault — Supabase Storage bucket
-- Run in Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/_/sql

-- 1. Create private bucket (25 MB file limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-vault',
  'document-vault',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. ERP uses SUPABASE_SERVICE_ROLE_KEY server-side only (bypasses RLS).
--    Do NOT add public read policies — all access goes through authenticated ERP routes.

-- Optional: allow authenticated users to read their own uploads via RLS (not used by ERP today)
-- create policy "document_vault_service_only"
--   on storage.objects for all
--   using (bucket_id = 'document-vault');
