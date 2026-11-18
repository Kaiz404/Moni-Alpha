"""Cat Pebble for Python callers, with the API of the old catart.py art module.

The art lives in @repo/brand (packages/brand/src/cat.ts); every function here runs it through
scripts/call.ts with Node 22.18 or later on PATH. Never draw geometry here.
"""
import json
import os
import subprocess

_CALL = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'scripts', 'call.ts')


def _node(*request):
    out = subprocess.run(['node', _CALL, json.dumps(request)], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


# The palette, GROUNDS, MOODS, MOOD_SPEC, MOOD_NOTES, MONO, MONO_VB, LOCKUP and the geometry constants.
globals().update(_node('constants'))


def _f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def figure(mood='neutral', ground='deep', fit=None, lift=None):
    return _node('figure', mood, ground, dict(fit=fit, lift=lift))


def cat_svg(mood='neutral', size=180, ground='deep', tile=True, id_prefix='x', label=None):
    return _node('catSvg', mood, dict(size=size, ground=ground, tile=tile, idPrefix=id_prefix, label=label))


def mono_figure(mood='neutral', color=None, mask_id='mono', fit=None, lift=None, spec=None):
    return _node('monoFigure', mood, color, mask_id, dict(fit=fit, lift=lift, spec=spec))


_mono_ids = [0]


def cat_mono_svg(size=96, color=None, mood='neutral', id_prefix='m', label=None, tile=False, tile_color=None,
                 spec=None):
    _mono_ids[0] += 1
    return _node('catMonoSvg', mood, dict(size=size, color=color, idPrefix=id_prefix, label=label, tile=tile,
                                          tileColor=tile_color, spec=spec, maskId=f'{id_prefix}-mono{_mono_ids[0]}'))


def wordmark_html(size, color=None, dot=True, dot_color=None):
    return _node('wordmarkHtml', size, dict(color=color, dot=dot, dotColor=dot_color))


def lockup_html(kind='horizontal', size=80, ground='cream', dot=True):
    return _node('lockupHtml', kind, dict(size=size, ground=ground, dot=dot))


def ear_base():
    return [tuple(p) for p in _node('earBase')]
