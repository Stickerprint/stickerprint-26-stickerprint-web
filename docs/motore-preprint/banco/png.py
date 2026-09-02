#!/usr/bin/env python3
"""Converte i .raw del banco in PNG guardabili.   uso: python3 png.py pieno.raw 600 600"""
import sys, numpy as np
from PIL import Image
f,W,H=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
a=np.frombuffer(open(f,'rb').read(),dtype=np.uint8).reshape(H,W,4)
al=a[...,3:4]/255.
out=(a[...,:3]*al+np.array([243,243,244],float)*(1-al)).astype(np.uint8)
Image.fromarray(out).save(f.replace('.raw','.png'))
print('scritto',f.replace('.raw','.png'))
