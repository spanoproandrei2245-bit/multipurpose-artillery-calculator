/*
    Multipurpose Artillery Calculator — export terrain heights.

    1. Open the map in the Eden editor, press Play (Preview).
    2. Esc -> Debug Console -> paste this script -> LOCAL EXEC.
    3. The heights are copied to the clipboard: paste them into the
       calculator (Map -> Load heights).

    Step 50 m covers a 30 km map in about 1.5 MB. Use 25 for small maps.
*/
private _step = 50;
private _size = worldSize;
private _n = floor (_size / _step) + 1;
private _rows = [];

for "_j" from 0 to (_n - 1) do {
    private _row = [];
    for "_i" from 0 to (_n - 1) do {
        _row pushBack (round (getTerrainHeightASL [_i * _step, _j * _step]));
    };
    _rows pushBack (_row joinString ",");
};

copyToClipboard (
    '{"format":"arma-heightmap","version":1,"world":"' + worldName
    + '","worldSize":' + str _size
    + ',"step":' + str _step
    + ',"rows":[[' + (_rows joinString "],[") + ']]}'
);

hint format ["%1: %2 x %2 points, step %3 m — copied to clipboard", worldName, _n, _step];
