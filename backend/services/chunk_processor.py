"""Chunk-based file processing for large PQ analyzer files."""
from __future__ import annotations

import io
from typing import Callable

import pandas as pd

from models.schema import AuditMetadata, PQRow


class ChunkProcessor:
    """Process files in chunks to handle large datasets efficiently."""

    def __init__(self, chunk_size: int = 10000):
        self.chunk_size = chunk_size

    def process_file_chunked(
        self,
        file_bytes: bytes,
        filename: str,
        processor: Callable[[pd.DataFrame], list[PQRow]],
        on_chunk_complete: Callable[[int, int], None] | None = None,
    ) -> list[PQRow]:
        """
        Process file in chunks.

        Args:
            file_bytes: File content
            filename: Filename for format detection
            processor: Function to process DataFrame chunks
            on_chunk_complete: Callback(rows_processed, total_so_far)

        Returns:
            List of processed PQRow objects
        """
        try:
            # Detect file format and load
            if filename.lower().endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file_bytes))
            elif filename.lower().endswith(('.xlsx', '.xls', '.xlsb', '.xlsm')):
                engine = "calamine" if filename.lower().endswith(('.xlsx', '.xlsb', '.xlsm')) else None
                df = pd.read_excel(io.BytesIO(file_bytes), engine=engine)
            else:
                raise ValueError(f"Unsupported file format: {filename}")

        except Exception as exc:
            raise ValueError(f"Failed to read file: {exc}") from exc

        all_rows: list[PQRow] = []
        total_chunks = (len(df) + self.chunk_size - 1) // self.chunk_size

        for chunk_idx in range(total_chunks):
            start_idx = chunk_idx * self.chunk_size
            end_idx = min(start_idx + self.chunk_size, len(df))
            chunk = df.iloc[start_idx:end_idx]

            try:
                chunk_rows = processor(chunk)
                all_rows.extend(chunk_rows)

                if on_chunk_complete:
                    on_chunk_complete(len(chunk_rows), len(all_rows))

            except Exception as exc:
                raise ValueError(
                    f"Error processing chunk {chunk_idx + 1}/{total_chunks}: {exc}",
                ) from exc

        return all_rows

    def get_memory_estimate(self, row_count: int) -> dict[str, int]:
        """
        Estimate memory usage for dataset.

        Returns:
            Dict with estimates in bytes
        """
        row_size_bytes = 256  # Approximate bytes per PQRow
        total_bytes = row_count * row_size_bytes

        return {
            "estimated_bytes": total_bytes,
            "estimated_mb": total_bytes // (1024 * 1024),
            "chunk_count_at_10k": (row_count + 9999) // 10000,
            "chunk_count_at_50k": (row_count + 49999) // 50000,
        }
