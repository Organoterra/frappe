# Copyright (c) 2026, Organoterra and Contributors
# License: MIT. See LICENSE

import unittest

from frappe.utils.duplicate_detection import (
	UnionFind,
	escape_like,
	extract_domain,
	normalize_company_name,
	normalize_email,
	normalize_identifier,
	normalize_text,
)


class TestDuplicateDetectionNormalize(unittest.TestCase):
	def test_normalize_email(self):
		self.assertEqual(normalize_email("  Foo@Bar.COM "), "foo@bar.com")
		self.assertEqual(normalize_email(None), "")

	def test_normalize_identifier(self):
		self.assertEqual(normalize_identifier(" abc de 123 "), "ABC DE 123")
		self.assertEqual(normalize_identifier(None), "")

	def test_extract_domain(self):
		self.assertEqual(extract_domain("a@Acme.COM"), "acme.com")
		self.assertEqual(extract_domain("https://www.Acme.com/path"), "acme.com")
		self.assertIsNone(extract_domain(""))

	def test_normalize_company_name(self):
		self.assertEqual(normalize_company_name("Acme Pvt. Ltd."), "acme")
		self.assertEqual(normalize_company_name("Acme Private Limited"), "acme")

	def test_escape_like(self):
		self.assertEqual(escape_like("a_b%c"), "a\\_b\\%c")

	def test_normalize_text(self):
		self.assertEqual(normalize_text("  Hello   World "), "hello world")

	def test_union_find(self):
		uf = UnionFind()
		uf.union(1, 2)
		uf.union(2, 3)
		groups = uf.groups()
		self.assertEqual(len(groups), 1)
		self.assertEqual(sorted(groups[0]), [1, 2, 3])
