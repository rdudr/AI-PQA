import time
import os
import io
from services.chunk_processor import ChunkProcessor
from parsers.custom_csv import CustomCSVParser
from models.schema import AuditMetadata
import pandas as pd

def run_benchmark():
    file_path = "../synthetic_pq_data_5000.csv"
    if not os.path.exists(file_path):
        print(f"File {file_path} not found.")
        return

    with open(file_path, "rb") as f:
        file_bytes = f.read()
    
    print(f"File size: {len(file_bytes) / 1024 / 1024:.2f} MB")
    
    parser = CustomCSVParser()
    processor = ChunkProcessor(chunk_size=1000)
    
    def process_chunk(chunk_df):
        return parser.parse_dataframe(chunk_df)

    start_time = time.time()
    
    def on_chunk(processed, total):
        pass

    rows = processor.process_file_chunked(
        file_bytes=file_bytes,
        filename="synthetic_pq_data_5000.csv",
        processor=process_chunk,
        on_chunk_complete=on_chunk
    )
    
    end_time = time.time()
    
    duration = end_time - start_time
    print(f"Processed {len(rows)} rows in {duration:.2f} seconds.")
    print(f"Throughput: {len(rows) / duration:.2f} rows/second.")
    
    estimates = processor.get_memory_estimate(len(rows))
    print(f"Memory estimates from ChunkProcessor: {estimates}")

if __name__ == "__main__":
    run_benchmark()
