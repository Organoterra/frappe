# Copyright (c) 2026, Organoterra and Contributors
# License: MIT. See LICENSE

"""Pure text-normalization helpers for duplicate detection.

No database or DocType imports — safe to reuse from any app.
"""

from __future__ import annotations

import re

# Longest-first so "private limited" wins over "limited".
COMPANY_SUFFIXES = (
	"private limited",
	"pvt ltd",
	"corporation",
	"incorporated",
	"limited",
	"pvt",
	"llc",
	"llp",
	"ltd",
	"company",
	"corp",
	"inc",
)


def normalize_email(email: str | None) -> str:
	return (email or "").strip().lower()


def normalize_text(value: str | None) -> str:
	return " ".join((value or "").split()).lower()


def normalize_identifier(value: str | None) -> str:
	"""GSTIN / PAN style identifiers: collapse whitespace, uppercase."""
	return " ".join((value or "").split()).upper()


def escape_like(value: str) -> str:
	return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def extract_domain(value: str | None) -> str | None:
	raw = normalize_text(value)
	if not raw:
		return None
	if "@" in raw:
		raw = raw.rsplit("@", 1)[1]
	if "://" in raw:
		raw = raw.split("://", 1)[1]
	raw = raw.split("/", 1)[0].split(":", 1)[0]
	if raw.startswith("www."):
		raw = raw[4:]
	return raw.strip(".") or None


def normalize_company_name(name: str | None) -> str:
	"""Lowercase, strip punctuation, remove trailing legal suffixes."""
	if not name:
		return ""
	value = re.sub(r"[^a-z0-9\s]", " ", str(name).strip().lower())
	value = re.sub(r"\s+", " ", value).strip()
	for _ in range(len(COMPANY_SUFFIXES)):
		for suffix in COMPANY_SUFFIXES:
			token = f" {suffix}"
			if value.endswith(token):
				value = value[: -len(token)].strip()
				break
		else:
			break
	return value


class UnionFind:
	"""Disjoint-set for merging duplicate groups (e.g. CSV row clustering)."""

	def __init__(self):
		self._parent: dict = {}
		self._rank: dict = {}

	def find(self, x):
		if x not in self._parent:
			self._parent[x] = x
			self._rank[x] = 0
		if self._parent[x] != x:
			self._parent[x] = self.find(self._parent[x])
		return self._parent[x]

	def union(self, x, y):
		px, py = self.find(x), self.find(y)
		if px == py:
			return
		if self._rank[px] < self._rank[py]:
			px, py = py, px
		self._parent[py] = px
		if self._rank[px] == self._rank[py]:
			self._rank[px] += 1

	def groups(self) -> list[list]:
		result: dict = {}
		for x in self._parent:
			root = self.find(x)
			result.setdefault(root, []).append(x)
		return list(result.values())
