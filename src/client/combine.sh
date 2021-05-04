#!/bin/bash

chunk_folder_path=$1 # path to chunks folder
prefix=$2 # prefix of chunks name
output_path=$3 # output path

cat $chunk_folder_path/$prefix* > "$output_path"