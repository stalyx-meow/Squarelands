class_name SquarelandsMap
extends Control
const Art = preload("res://scripts/pixel_art.gd")
signal tile_selected(tile: Vector2i)
signal hovered(tile: Vector2i)
var state: Dictionary = {}
var selected := Vector2i(-99999, -99999)
var hover := Vector2i(-99999, -99999)
var offset := Vector2(120, 80)
var cell := 48.0
var dragging := false
var drag_distance := 0.0
var build_mode := ""
var font: Font
var clock := 0.0
const TERRAIN := {"plain":Color("b8c98c"),"hill":Color("aaba80"),"plateau":Color("c2b58b"),"mountain":Color("a6b08e"),"river":Color("759fa7"),"lake":Color("6e969f"),"ocean":Color("648c99")}

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	clip_contents = true

func tile_at(point: Vector2) -> Vector2i:
	return Vector2i(floor((point.x-offset.x)/cell), floor((point.y-offset.y)/cell))

func center_on(point: Vector2) -> void:
	offset = Vector2(size.x * 0.4, size.y * 0.48) - (point + Vector2(0.5,0.5)) * cell
	queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN] and event.pressed:
			var anchor: Vector2 = (event.position-offset)/cell
			cell = clampf(cell+(8 if event.button_index==MOUSE_BUTTON_WHEEL_UP else -8),24,96)
			offset = event.position-anchor*cell
		elif event.button_index in [MOUSE_BUTTON_LEFT,MOUSE_BUTTON_RIGHT,MOUSE_BUTTON_MIDDLE]:
			if event.pressed:
				dragging=true
				drag_distance=0
			else:
				dragging=false
				if event.button_index==MOUSE_BUTTON_LEFT and drag_distance<6:
					selected=tile_at(event.position)
					tile_selected.emit(selected)
		queue_redraw()
	elif event is InputEventMouseMotion:
		if dragging:
			offset+=event.relative
			drag_distance+=event.relative.length()
		var next := tile_at(event.position)
		if hover!=next:
			hover=next
			hovered.emit(hover)
		queue_redraw()
	elif event is InputEventScreenDrag:
		offset+=event.relative
		queue_redraw()
	elif event is InputEventMagnifyGesture:
		var anchor: Vector2 = (event.position-offset)/cell
		cell=clampf(cell*event.factor,12,100)
		offset=event.position-anchor*cell
		queue_redraw()

func _process(delta: float) -> void:
	clock+=delta
	if not get_viewport().gui_get_focus_owner() is LineEdit and not get_viewport().gui_get_focus_owner() is TextEdit:
		var direction := Vector2(float(Input.is_physical_key_pressed(KEY_A))-float(Input.is_physical_key_pressed(KEY_D)),float(Input.is_physical_key_pressed(KEY_W))-float(Input.is_physical_key_pressed(KEY_S)))
		offset+=direction*delta*450
	if not state.is_empty(): queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO,size),Color("e5ecde"))
	if state.is_empty(): return
	var world: Dictionary = state.get("world",{})
	var tiles: Array = world.get("tiles",[])
	var width := int(world.get("width",0))
	if width==0 or tiles.is_empty(): return
	var min_x := int(world.get("minX",0))
	var min_y := int(world.get("minY",0))
	var height := int(world.get("height",0))
	var claims: Dictionary = state.get("claims",{})
	var cities: Dictionary = {}
	var buildings: Dictionary = {}
	for c in state.get("cities",[]):
		cities[c.id]=c
		for b in c.buildings: buildings["%d,%d" % [b.x,b.y]]=b
	var first := tile_at(Vector2.ZERO)-Vector2i.ONE
	var last := tile_at(size)+Vector2i.ONE
	for y in range(maxi(min_y,first.y),mini(min_y+height,last.y+1)):
		for x in range(maxi(min_x,first.x),mini(min_x+width,last.x+1)):
			var i := (y-min_y)*width+x-min_x
			if i<0 or i>=tiles.size(): continue
			var tile: Dictionary = tiles[i]
			var k := "%d,%d" % [x,y]
			var p := offset+Vector2(x,y)*cell
			var rect := Rect2(p,Vector2.ONE*cell)
			var color: Color = TERRAIN.get(tile.terrain,Color("b8c98c"))
			color=color.lightened(float(posmod(x*17+y*29,9))/150)
			draw_rect(rect,color)
			Art.tile(self,p,cell,tile.terrain,x,y)
			if claims.has(k) and cities.has(claims[k]):
				var c: Dictionary = cities[claims[k]]
				var tint := Color(state.get("profiles",{}).get(c.owner,{}).get("color","#cfb77b"))
				draw_rect(rect,Color(tint,.12))
				for step in [Vector2i(-1,0),Vector2i(1,0),Vector2i(0,-1),Vector2i(0,1)]:
					if claims.get("%d,%d" % [x+step.x,y+step.y],"")!=c.id:
						if step.x!=0:
							var xx: float = p.x+(cell if step.x>0 else 0)
							draw_line(Vector2(xx,p.y),Vector2(xx,p.y+cell),tint,2)
						else:
							var yy: float = p.y+(cell if step.y>0 else 0)
							draw_line(Vector2(p.x,yy),Vector2(p.x+cell,yy),tint,2)
			if cell>20: draw_rect(rect,Color(0,0,0,.12),false,1)
			if tile.get("deposit")!=null and cell>24:
				draw_circle(p+Vector2(cell*.18,cell*.2),maxf(2,cell*.07),Color("d2b77a"))
			if state.get("rails",{}).has(k):
				var center := p+Vector2.ONE*cell*.5
				for step in [Vector2i(-1,0),Vector2i(1,0),Vector2i(0,-1),Vector2i(0,1)]:
					if state.rails.has("%d,%d" % [x+step.x,y+step.y]):
						draw_line(center,center+Vector2(step)*cell*.52,Color("c3c8bb"),3)
				draw_circle(center,2,Color("292f31"))
			if buildings.has(k):
				var b: Dictionary = buildings[k]
				Art.building(self,p,cell,b.type,b.get("readyAt")!=null)
	for c in cities.values():
		var p := offset+(Vector2(c.x,c.y)+Vector2(.5,.5))*cell
		Art.city(self,p-Vector2.ONE*cell*.5,cell)
		if font and cell>18:
			var label: String = c.name
			var extent := font.get_string_size(label,HORIZONTAL_ALIGNMENT_LEFT,-1,14)
			draw_rect(Rect2(p+Vector2(-extent.x/2-6,cell*.42),extent+Vector2(12,8)),Color("101d24"))
			draw_string(font,p+Vector2(-extent.x/2,cell*.42+17),label,HORIZONTAL_ALIGNMENT_LEFT,-1,14,Color("f1e5c6"))
	for sh in state.get("shipments",[]):
		if sh.status!="transit" or sh.path.is_empty(): continue
		var points := PackedVector2Array()
		for p in sh.path: points.append(offset+(Vector2(p.x,p.y)+Vector2(.5,.5))*cell)
		var color := Color("8bc5dd") if sh.get("mode","")=="air" else Color("ebc77c")
		if points.size()>1: draw_polyline(points,Color(color,.45),1.5,true)
		var progress := clampf((float(Time.get_unix_time_from_system())*1000-float(sh.departAt))/maxf(1,float(sh.arriveAt)-float(sh.departAt)),0,1)
		var segment := progress*(points.size()-1)
		var at := mini(int(segment),points.size()-1)
		var dot := points[at].lerp(points[mini(at+1,points.size()-1)],fmod(segment,1))
		draw_circle(dot,3,color)
	for tile in [hover,selected]:
		if tile.x>-99999:
			var rect := Rect2(offset+Vector2(tile)*cell,Vector2.ONE*cell)
			draw_rect(rect,Color("f3d48f") if tile==selected else Color(1,1,1,.5),false,2)
	if build_mode!="" and hover.x>-99999:
		draw_rect(Rect2(offset+Vector2(hover)*cell,Vector2.ONE*cell),Color(.8,.7,.4,.25))
