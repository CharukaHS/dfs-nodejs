#!/bin/bash

file_path=$1 #path to the file
chunk_name=$2 #output file name
n=$3 #chunk side, in megabytes

split -b "$n"m $file_path $chunk_name