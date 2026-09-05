# Copyright (c) 2026, Organoterra and Contributors
# License: MIT. See LICENSE

"""Shared, DocType-agnostic helpers for duplicate detection.

ERPNext (and other apps) own matching against specific DocTypes; this package
only normalizes values so comparisons stay consistent across apps.
"""

from frappe.utils.duplicate_detection.normalize import (
	UnionFind,
	escape_like,
	extract_domain,
	normalize_company_name,
	normalize_email,
	normalize_identifier,
	normalize_text,
)

__all__ = [
	"UnionFind",
	"escape_like",
	"extract_domain",
	"normalize_company_name",
	"normalize_email",
	"normalize_identifier",
	"normalize_text",
]
