import { describe, expect, it } from 'vitest';
import type { FieldDef, FormConfig } from '@/lib/supabase/types';
import {
  buildSubmissionData,
  exposedFields,
  missingRequiredFields,
  sanitiseFilename,
  sniffContainer,
  submissionSchema,
  uploadRules,
} from './config';

const FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', data_type: 'text', required: true, position: 0 },
  { key: 'status', label: 'Status', data_type: 'enum', position: 1, options: { choices: ['received', 'assessed'] } },
  { key: 'contact_email', label: 'Email', data_type: 'text', required: true, position: 4 },
  { key: 'contact_name', label: 'Name', data_type: 'text', position: 3 },
  { key: 'consent', label: 'Consent', data_type: 'boolean', position: 5 },
];

function form(partial: Partial<FormConfig> = {}): FormConfig {
  return {
    targetType: 'submission',
    enabled: true,
    fields: ['contact_email', 'contact_name'],
    presets: { title: 'Sub #{{submission_number}}', status: 'received' },
    copy: { title: 'T' },
    ...partial,
  };
}

describe('exposedFields', () => {
  it('returns only exposed fields, in display order', () => {
    const got = exposedFields(form(), FIELDS);
    expect(got.map((f) => f.key)).toEqual(['contact_name', 'contact_email']);
  });
});

describe('missingRequiredFields', () => {
  it('is empty when every required field is exposed or preset', () => {
    expect(missingRequiredFields(form(), FIELDS)).toEqual([]);
  });

  it('flags required fields that are neither exposed nor preset', () => {
    expect(missingRequiredFields(form({ presets: {} }), FIELDS)).toEqual(['title']);
  });
});

describe('submissionSchema', () => {
  it('validates exposed fields only', () => {
    const schema = submissionSchema(form(), FIELDS);
    expect(schema.safeParse({ contact_email: 'a@b.co' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false); // contact_email required
  });
});

describe('buildSubmissionData', () => {
  it('merges submitter values with token-rendered presets', () => {
    const data = buildSubmissionData(
      form(),
      { contact_email: 'a@b.co', contact_name: 'Ada' },
      { submission_number: 3 },
    );
    expect(data).toEqual({
      contact_email: 'a@b.co',
      contact_name: 'Ada',
      title: 'Sub #3',
      status: 'received',
    });
  });

  it('presets win — a submitter cannot override a preset field', () => {
    const data = buildSubmissionData(form(), { status: 'assessed', contact_email: 'a@b.co' }, {});
    expect(data.status).toBe('received');
  });

  it('ignores values for fields not exposed on the form', () => {
    const data = buildSubmissionData(form(), { consent: true, contact_email: 'a@b.co' }, {});
    expect(data.consent).toBeUndefined();
  });

  it('drops empty submitter values', () => {
    const data = buildSubmissionData(form(), { contact_email: 'a@b.co', contact_name: '' }, {});
    expect('contact_name' in data).toBe(false);
  });
});

describe('uploadRules', () => {
  it('defaults sensibly when uploads are unset', () => {
    const rules = uploadRules(form());
    expect(rules.enabled).toBe(false);
    expect(rules.maxFiles).toBe(8);
    expect(rules.minFiles).toBe(0);
  });
});

describe('sniffContainer', () => {
  it('detects PDF magic bytes', () => {
    expect(sniffContainer(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe('pdf');
  });
  it('detects any OOXML (zip) magic bytes — kind resolved separately by sniffOoxmlKind', () => {
    expect(sniffContainer(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe('zip');
  });
  it('rejects anything else', () => {
    expect(sniffContainer(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull(); // PNG
    expect(sniffContainer(new Uint8Array([]))).toBeNull();
  });
});

describe('sanitiseFilename', () => {
  it('strips directory traversal', () => {
    expect(sanitiseFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitiseFilename('C:\\evil\\name.pdf')).toBe('name.pdf');
  });
  it('replaces exotic characters and caps length', () => {
    expect(sanitiseFilename('a<b>:c.pdf')).toBe('a_b__c.pdf');
    expect(sanitiseFilename(`${'x'.repeat(200)}.pdf`).length).toBeLessThanOrEqual(120);
  });
  it('never returns empty', () => {
    expect(sanitiseFilename('///')).toBe('file');
  });
});
