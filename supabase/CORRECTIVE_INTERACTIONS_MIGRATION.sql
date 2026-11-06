-- ==========================================================================
-- SIGNSYNC LEAD MANAGEMENT V2.0: CORRECTIVE INTERACTIONS MIGRATION
-- Source: crm_follow_ups (36 historical records)
-- Destination: crm_lead_interactions


-- Widen outcome column from VARCHAR(32) to VARCHAR(100) or TEXT to safely store legacy dispositions
ALTER TABLE public.crm_lead_interactions ALTER COLUMN outcome TYPE VARCHAR(100);

INSERT INTO public.crm_lead_interactions (
  id, lead_id, conducted_by, channel_id, outcome, reason, conversation_notes, next_follow_up_date, supervisor_override, override_reason, created_at
) VALUES
  ('fu-1793779009347', 'lead-001', 'usr-admin-root', 'chan-whatsapp', 'Customer agreed to proforma invoice', 'Follow up regarding 50 combo tokens quote', 'Follow up regarding 50 combo tokens quote', '2026-11-05'::date, 0, NULL, '2026-11-04T07:56:49+00:00'::timestamptz),
  ('fu-1793779026785', 'lead-001', 'usr-admin-root', 'chan-whatsapp', 'Customer agreed to proforma invoice', 'Follow up regarding 50 combo tokens quote', 'Follow up regarding 50 combo tokens quote', '2026-11-05'::date, 0, NULL, '2026-11-04T07:57:06+00:00'::timestamptz),
  ('fu-1793785422709', 'lead-1793785422674', 'usr-admin-root', 'chan-phone-call', 'interested_quote_sent', 'Quotation sent via email', 'Quotation sent via email', '2026-11-06'::date, 0, NULL, '2026-11-04T09:43:42+00:00'::timestamptz),
  ('fu-1793869858751', 'lead-1793869857346', 'usr-1793788284595', 'chan-phone-call', 'Interested', 'Historical follow-up', '', '2026-11-05'::date, 0, NULL, '2026-11-05T09:10:59.057308+00:00'::timestamptz),
  ('fu-1793869859631', 'lead-1793869857346', 'usr-1793788284595', 'chan-phone-call', 'Interested', 'Contacted client regarding DSC renewal.', 'Contacted client regarding DSC renewal.', '2026-11-05'::date, 0, NULL, '2026-11-05T09:10:59.937556+00:00'::timestamptz),
  ('fu-1793870127325', 'lead-1793870125719', 'usr-1793788284595', 'chan-phone-call', 'Interested', 'Contacted client regarding DSC renewal.', 'Contacted client regarding DSC renewal.', '2026-11-05'::date, 0, NULL, '2026-11-05T09:15:27.634646+00:00'::timestamptz),
  ('fu-1793870255903', 'lead-1793870254142', 'usr-1793788284595', 'chan-phone-call', 'Interested', 'Contacted client regarding DSC renewal.', 'Contacted client regarding DSC renewal.', '2026-11-05'::date, 0, NULL, '2026-11-05T09:17:36.200569+00:00'::timestamptz),
  ('fu-1793870455113', 'lead-1793870453406', 'usr-1793788284595', 'chan-phone-call', 'Interested', 'Contacted client regarding DSC renewal.', 'Contacted client regarding DSC renewal.', '2026-11-05'::date, 0, NULL, '2026-11-05T09:20:55.404577+00:00'::timestamptz),
  ('fu-1793870585505', 'lead-1793870583149', 'usr-1793788284595', 'chan-phone-call', 'Interested', 'Contacted client regarding DSC renewal.', 'Contacted client regarding DSC renewal.', '2026-11-05'::date, 0, NULL, '2026-11-05T09:23:05.78827+00:00'::timestamptz),
  ('fu-1793870673471', 'lead-1793870671833', 'usr-1793788284595', 'chan-phone-call', 'Interested', 'Contacted client regarding DSC renewal.', 'Contacted client regarding DSC renewal.', '2026-11-05'::date, 0, NULL, '2026-11-05T09:24:33.762151+00:00'::timestamptz),
  ('fu-1793944302675', 'lead-1793944299913', 'usr-admin-root', 'chan-whatsapp', 'Interested', 'Sent PDF catalog on WhatsApp', NULL, '2026-11-10'::date, 0, NULL, '2026-11-06T05:51:42.434469+00:00'::timestamptz),
  ('fu-1793944504425', 'lead-1793944502160', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', NULL, '2026-11-15'::date, 0, NULL, '2026-11-06T05:55:04.24931+00:00'::timestamptz),
  ('fu-1793944589112', 'lead-1793944586030', 'usr-admin-root', 'chan-whatsapp', 'Interested', 'Sent PDF catalog on WhatsApp', NULL, '2026-11-10'::date, 0, NULL, '2026-11-06T05:56:28.699789+00:00'::timestamptz),
  ('fu-1793944592380', 'lead-1793944590639', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', NULL, '2026-11-20'::date, 0, NULL, '2026-11-06T05:56:31.888538+00:00'::timestamptz),
  ('fu-1793944731339', 'lead-1793944728170', 'usr-admin-root', 'chan-whatsapp', 'Interested', 'Sent PDF catalog on WhatsApp', NULL, '2026-11-10'::date, 0, NULL, '2026-11-06T05:58:51.083607+00:00'::timestamptz),
  ('fu-1793944734923', 'lead-1793944733078', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', NULL, '2026-11-20'::date, 0, NULL, '2026-11-06T05:58:54.445374+00:00'::timestamptz),
  ('fu-1793944879534', 'lead-1793944876876', 'usr-admin-root', 'chan-whatsapp', 'Interested', 'Sent PDF catalog on WhatsApp', NULL, '2026-11-10'::date, 0, NULL, '2026-11-06T06:01:19.499963+00:00'::timestamptz),
  ('fu-1793944882752', 'lead-1793944881211', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', NULL, '2026-11-20'::date, 0, NULL, '2026-11-06T06:01:22.2745+00:00'::timestamptz),
  ('fu-1793947911885', 'lead-1793947909644', 'usr-admin-root', 'chan-whatsapp', 'Interested', 'Sent PDF catalog on WhatsApp', NULL, '2026-11-10'::date, 0, NULL, '2026-11-06T06:51:51.376734+00:00'::timestamptz),
  ('fu-1793947914277', 'lead-1793947912934', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', NULL, '2026-11-20'::date, 0, NULL, '2026-11-06T06:51:53.676688+00:00'::timestamptz),
  ('fu-1793949276805', 'lead-1793949274616', 'usr-admin-root', 'chan-whatsapp', 'Interested', 'Sent PDF catalog on WhatsApp', NULL, '2026-11-10'::date, 0, NULL, '2026-11-06T07:14:36.151214+00:00'::timestamptz),
  ('fu-1793949279167', 'lead-1793949277791', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', NULL, '2026-11-20'::date, 0, NULL, '2026-11-06T07:14:38.528483+00:00'::timestamptz),
  ('int-1793944302372-vbnc', 'lead-1793944299913', 'usr-admin-root', 'chan-whatsapp', 'Partially Interested', 'Evaluating quote; requested revision by Monday', 'Sent PDF catalog on WhatsApp', '2026-11-10'::date, 0, NULL, '2026-11-06T05:51:42.372+00:00'::timestamptz),
  ('int-1793944504212-8a8q', 'lead-1793944502160', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', 'None', '2026-11-15'::date, 1, 'Branch expansion authorization by Regional Manager', '2026-11-06T05:55:04.212+00:00'::timestamptz),
  ('int-1793944588795-sh1d', 'lead-1793944586030', 'usr-admin-root', 'chan-whatsapp', 'Partially Interested', 'Evaluating quote; requested revision by Monday', 'Sent PDF catalog on WhatsApp', '2026-11-10'::date, 0, NULL, '2026-11-06T05:56:28.795+00:00'::timestamptz),
  ('int-1793944592139-uetd', 'lead-1793944590639', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', 'None', '2026-11-20'::date, 1, 'Branch expansion authorization by Regional Manager', '2026-11-06T05:56:32.139+00:00'::timestamptz),
  ('int-1793944731031-7kj5', 'lead-1793944728170', 'usr-admin-root', 'chan-whatsapp', 'Partially Interested', 'Evaluating quote; requested revision by Monday', 'Sent PDF catalog on WhatsApp', '2026-11-10'::date, 0, NULL, '2026-11-06T05:58:51.031+00:00'::timestamptz),
  ('int-1793944734691-84qz', 'lead-1793944733078', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', 'None', '2026-11-20'::date, 1, 'Branch expansion authorization by Regional Manager', '2026-11-06T05:58:54.691+00:00'::timestamptz),
  ('int-1793944879333-h43g', 'lead-1793944876876', 'usr-admin-root', 'chan-whatsapp', 'Partially Interested', 'Evaluating quote; requested revision by Monday', 'Sent PDF catalog on WhatsApp', '2026-11-10'::date, 0, NULL, '2026-11-06T06:01:19.333+00:00'::timestamptz),
  ('int-1793944882553-7avu', 'lead-1793944881211', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', 'None', '2026-11-20'::date, 1, 'Branch expansion authorization by Regional Manager', '2026-11-06T06:01:22.553+00:00'::timestamptz),
  ('int-1793947911697-2pu3', 'lead-1793947909644', 'usr-admin-root', 'chan-whatsapp', 'Partially Interested', 'Evaluating quote; requested revision by Monday', 'Sent PDF catalog on WhatsApp', '2026-11-10'::date, 0, NULL, '2026-11-06T06:51:51.697+00:00'::timestamptz),
  ('int-1793947914077-gofz', 'lead-1793947912934', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', 'None', '2026-11-20'::date, 1, 'Branch expansion authorization by Regional Manager', '2026-11-06T06:51:54.077+00:00'::timestamptz),
  ('fu-1793950321118', 'lead-1793950319056', 'usr-admin-root', 'chan-whatsapp', 'Interested', 'Sent PDF catalog on WhatsApp', NULL, '2026-11-10'::date, 0, NULL, '2026-11-06T07:32:00.424055+00:00'::timestamptz),
  ('fu-1793950323950', 'lead-1793950322104', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', NULL, '2026-11-20'::date, 0, NULL, '2026-11-06T07:32:03.27409+00:00'::timestamptz),
  ('fu-1793955121233', 'lead-1793955118924', 'usr-admin-root', 'chan-whatsapp', 'Interested', 'Sent PDF catalog on WhatsApp', NULL, '2026-11-10'::date, 0, NULL, '2026-11-06T08:52:00.40969+00:00'::timestamptz),
  ('fu-1793955124325', 'lead-1793955122652', 'usr-admin-root', 'chan-phone-call', 'Interested', 'Partner requested new branch setup', NULL, '2026-11-20'::date, 0, NULL, '2026-11-06T08:52:03.512403+00:00'::timestamptz)
ON CONFLICT (id) DO NOTHING;
