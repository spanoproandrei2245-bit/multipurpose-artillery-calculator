[] spawn {

closeDialog 0;
uiSleep 0.5;

private _folder = "D:\gradphoto\";
private _size = worldSize;
private _res = getResolution;
private _resW = _res select 0;
private _resH = _res select 1;
private _targetMpp = 1.5;
private _overlap = 0.92;

private _say = {
	params ["_text"];
	systemChat format ["GRADPHOTO: %1", _text];
};

private _display = findDisplay 46 createDisplay "RscDisplayEmpty";
private _map = _display ctrlCreate ["RscMapControl", -1];
_map ctrlSetPosition [0, 0, 1, 1];
_map ctrlCommit 0;

private _zoom = 0.05;
private _mid = [_size / 2, _size / 2, 0];
for "_k" from 1 to 5 do {
	_map ctrlMapAnimAdd [0, _zoom, _mid];
	ctrlMapAnimCommit _map;
	waitUntil { ctrlMapAnimDone _map };
	uiSleep 0.3;
	private _tl = _map ctrlMapScreenToWorld [0, 0];
	private _br = _map ctrlMapScreenToWorld [1, 1];
	private _w = (_br select 0) - (_tl select 0);
	_zoom = _zoom * (_targetMpp * _resW) / _w;
};

_map ctrlMapAnimAdd [0, _zoom, _mid];
ctrlMapAnimCommit _map;
waitUntil { ctrlMapAnimDone _map };
uiSleep 0.3;
private _tl0 = _map ctrlMapScreenToWorld [0, 0];
private _br0 = _map ctrlMapScreenToWorld [1, 1];
private _viewW = (_br0 select 0) - (_tl0 select 0);
private _viewH = (_tl0 select 1) - (_br0 select 1);
private _stepW = _viewW * _overlap;
private _stepH = _viewH * _overlap;
private _cols = ceil (_size / _stepW);
private _rows = ceil (_size / _stepH);

diag_log format ["GRADPHOTO|META|%1|%2|%3|%4|%5|%6", toLower worldName, _size, _resW, _resH, _cols, _rows];
[format ["%1 x %2 shots, zoom %3", _cols, _rows, _zoom]] call _say;

for "_row" from 0 to (_rows - 1) do {
	for "_col" from 0 to (_cols - 1) do {
		private _cx = (_col + 0.5) * _stepW;
		private _cy = _size - (_row + 0.5) * _stepH;
		_map ctrlMapAnimAdd [0, _zoom, [_cx, _cy, 0]];
		ctrlMapAnimCommit _map;
		waitUntil { ctrlMapAnimDone _map };
		uiSleep 1.2;
		private _tl = _map ctrlMapScreenToWorld [0, 0];
		private _br = _map ctrlMapScreenToWorld [1, 1];
		private _name = format ["gradphoto_%1_%2_%3.png", toLower worldName, _row, _col];
		diag_log format ["GRADPHOTO|P|%1|%2|%3|%4|%5", _name, _tl select 0, _tl select 1, _br select 0, _br select 1];
		screenshot (_folder + _name);
		uiSleep 0.6;
	};
	[format ["row %1 of %2", _row + 1, _rows]] call _say;
};

diag_log "GRADPHOTO|END";
_display closeDisplay 1;
["done - you can close the game"] call _say;
hint "GRADPHOTO: done";
};
