import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from ingest_contract import (  # noqa: E402
    normalize_author_name,
    parse_x_status,
    safe_identifier,
    target_dimensions,
    x_title,
)


class IngestContractTest(unittest.TestCase):
    def test_normalizes_x_status(self):
        self.assertEqual(
            parse_x_status("https://twitter.com/artist/status/123"),
            ("123", "https://x.com/artist/status/123"),
        )

    def test_cleans_temporary_author_suffix(self):
        self.assertEqual(normalize_author_name("作者 @ C107 新刊"), "作者")

    def test_builds_responsive_dimensions(self):
        self.assertEqual(target_dimensions(1200, 800), [(640, 427), (960, 640), (1200, 800)])

    def test_sanitizes_identifier_and_title(self):
        self.assertEqual(safe_identifier("artist / 123"), "artist-123")
        self.assertEqual(x_title("#art https://example.com", "作者", "123"), "作者 · X 123")


if __name__ == "__main__":
    unittest.main()
