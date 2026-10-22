class_name SquarelandsPixelArt
extends RefCounted
static func r(c:CanvasItem,p:Vector2,s:float,x:float,y:float,w:float,h:float,color:String)->void:
	c.draw_rect(Rect2((p+Vector2(x,y)*s).round(),Vector2(w,h)*s+Vector2(.2,.2)),Color(color))
static func tile(c:CanvasItem,p:Vector2,cell:float,terrain:String,x:int,y:int)->void:
	var s:=cell/16.0
	var n:=absi(x*131+y*73)
	if terrain in ["ocean","lake","river"]:
		for i in range(3):r(c,p,s,posmod(n+i*7,12),posmod(n/3+i*5,14),3,1,"8db3b4" if i==0 else "6a929b")
	elif terrain=="mountain":
		for part in [[2,12,13,3,"5c6558"],[3,9,11,4,"788373"],[5,6,7,6,"909783"],[7,3,3,7,"b0b19b"],[7,3,2,2,"d4cfb6"],[5,8,2,2,"b0b19b"],[10,9,3,4,"657361"]]:r(c,p,s,part[0],part[1],part[2],part[3],part[4])
	else:
		for i in range(4):r(c,p,s,posmod(n+i*5,15),posmod(n/7+i*3,15),1,1,"a5b778" if terrain=="plain" else "b8ae84")
		if posmod(n,5)==0:
			for part in [[10,10,2,4,"76684c"],[8,7,6,4,"54754a"],[9,5,4,5,"658b55"],[10,4,2,3,"7c9c5c"]]:r(c,p,s,part[0],part[1],part[2],part[3],part[4])
		elif posmod(n,11)==0:r(c,p,s,3,10,3,1,"d4c979")
static func building(c:CanvasItem,p:Vector2,cell:float,type:String,unfinished:bool=false)->void:
	var s:=cell/16.0
	r(c,p,s,2,13,13,2,"6a7456")
	if type in ["farm","vegetableFarm"]:
		r(c,p,s,1,2,14,12,"806b45")
		for yy in [3,6,9,12]:
			r(c,p,s,2,yy,12,1,"c5b36f" if type=="farm" else "648e4c")
			for xx in [3,6,9,12]:r(c,p,s,xx,yy-1,1,1,"e1cc78" if type=="farm" else "9ab85b")
	elif type=="airport":
		for part in [[1,2,14,12,"868d7b"],[6,2,4,12,"626e69"],[7,4,2,8,"ece3bf"],[3,7,10,2,"ece3bf"],[5,11,6,1,"c2cdb2"]]:r(c,p,s,part[0],part[1],part[2],part[3],part[4])
	elif type=="station":
		for part in [[1,11,14,3,"646c60"],[2,4,12,7,"d2bc87"],[1,3,14,2,"8b5945"],[3,2,10,2,"b77550"],[1,12,14,1,"bcc1a1"]]:r(c,p,s,part[0],part[1],part[2],part[3],part[4])
		for xx in [3,7,11]:r(c,p,s,xx,6,2,3,"567373")
	elif type=="wall":
		r(c,p,s,1,5,14,9,"8b9482")
		for xx in [1,5,9,13]:r(c,p,s,xx,3,2,4,"adb49c")
	elif type in ["generator","blastFurnace","copperSmelter","goldRefinery","silverRefinery","rareRefinery","refinery"]:
		for part in [[2,6,12,8,"9a8c6f"],[3,2,3,10,"6c6d5e"],[3,1,3,2,"b4b298"],[8,4,5,3,"baac83"],[8,9,4,4,"5c594b"],[9,10,2,2,"dba55e"],[3,0,2,1,"c1c4ad"]]:r(c,p,s,part[0],part[1],part[2],part[3],part[4])
	else:
		var roof:="ad7351" if type!="warehouse" else "76856a"
		for part in [[3,7,11,7,"d9c99b"],[2,6,13,2,roof],[4,4,9,2,roof],[6,3,5,1,"cc9561"],[5,9,2,2,"6e9390"],[10,9,2,2,"6e9390"],[8,11,2,3,"7b6c4c"]]:r(c,p,s,part[0],part[1],part[2],part[3],part[4])
	if unfinished:
		for yy in [4,9,13]:r(c,p,s,1,yy,14,1,"b9a06c")
		for xx in [2,13]:r(c,p,s,xx,2,1,13,"735c42")
static func city(c:CanvasItem,p:Vector2,cell:float)->void:
	var s:=cell/16.0
	for part in [[1,12,15,3,"657557"],[2,7,12,7,"dbc99c"],[1,6,14,2,"ad6d4c"],[3,4,10,2,"bd8052"],[5,2,6,2,"cc965d"],[7,1,2,1,"dfb67a"],[7,10,3,4,"705943"],[12,0,1,7,"725d45"],[13,0,3,2,"5c8b80"]]:r(c,p,s,part[0],part[1],part[2],part[3],part[4])
	for xx in [3,11]:r(c,p,s,xx,9,2,2,"6c8b84")
