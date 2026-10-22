class_name SquarelandsConnection
extends Node
signal message(value: Dictionary)
signal connection_lost(reason: String)
var tcp := StreamPeerTCP.new()
var stream: StreamPeer
var secure: StreamPeerTLS
var incoming := PackedByteArray()
var outgoing := PackedByteArray()
var connected := false
var connecting := false
var host := ""
var use_tls := false
var sequence := 0
var started := 0
var heartbeat := 0.0
const MAX_FRAME := 64 * 1024 * 1024

var last_error := ""

static func parse_address(address: String) -> Dictionary:
	var value := address.strip_edges().replace("：",":")
	var secure_connection := value.to_lower().begins_with("tls://")
	if "://" in value:
		if not value.to_lower().begins_with("tcp://") and not secure_connection:return {"error":"Use tcp:// or tls:// / 请填写 TCP 地址，不要填写网页 URL"}
		value=value.substr(value.find("://")+3)
	value=value.trim_suffix("/")
	var hostname := ""
	var service_port := 3211
	var port_text := ""
	if value.begins_with("["):
		var end := value.find("]")
		if end<0:return {"error":"Invalid IPv6 brackets / IPv6 方括号不完整"}
		hostname=value.substr(1,end-1)
		if not hostname.is_valid_ip_address():return {"error":"Invalid IPv6 address / IPv6 地址无效"}
		if value.length()>end+1:
			if value[end+1]!=":":return {"error":"Invalid port separator / 端口分隔符无效"}
			port_text=value.substr(end+2)
	elif value.count(":")==1:
		var parts := value.split(":")
		hostname=parts[0]
		port_text=parts[1]
	else:hostname=value
	if (value.ends_with(":") and not value.is_valid_ip_address()) or (not port_text.is_empty() and (not port_text.is_valid_int() or port_text.begins_with("+") or port_text.begins_with("-"))):return {"error":"Invalid port / 端口须为 1–65535 的整数"}
	if not port_text.is_empty():service_port=port_text.to_int()
	if service_port<1 or service_port>65535:return {"error":"Port outside 1–65535 / 端口超出 1–65535"}
	if hostname.is_empty():return {"error":"Server host is empty / 请填写服务端 IP 或域名"}
	if not hostname.is_valid_ip_address():
		var label_pattern := RegEx.new()
		label_pattern.compile("^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")
		if hostname.length()>253:return {"error":"Host name is too long / 域名过长"}
		for label in hostname.trim_suffix(".").split("."):
			if label_pattern.search(label)==null:return {"error":"Invalid hostname; remove spaces, paths and credentials / 域名格式无效，请移除空格、路径或账号信息"}
	return {"host":hostname,"port":service_port,"tls":secure_connection}

func open(address: String) -> Error:
	close()
	last_error=""
	var parsed := parse_address(address)
	if parsed.has("error"):
		last_error=parsed.error
		return ERR_INVALID_PARAMETER
	host=parsed.host
	use_tls=parsed.tls
	tcp=StreamPeerTCP.new()
	var error := tcp.connect_to_host(host,int(parsed.port))
	if error!=OK:
		last_error="DNS resolution failed / 域名无法解析" if error==ERR_CANT_RESOLVE else "Cannot establish TCP connection / 无法建立 TCP 连接，请检查端口与转发配置"
		return error
	connecting=true
	started=Time.get_ticks_msec()
	return OK

func close() -> void:
	connecting = false
	connected = false
	incoming.clear()
	outgoing.clear()
	stream = null
	secure = null
	tcp.disconnect_from_host()

func request(op: String, data: Dictionary = {}, world: String = "") -> int:
	sequence += 1
	var payload := JSON.stringify({"id": sequence, "op": op, "data": data, "world": world}).to_utf8_buffer()
	if payload.size() > 32768:
		message.emit({"id":sequence,"ok":false,"error":"Request too large / 请求过大"})
		return sequence
	var frame := PackedByteArray()
	frame.resize(4)
	frame[0]=(payload.size() >> 24) & 255
	frame[1]=(payload.size() >> 16) & 255
	frame[2]=(payload.size() >> 8) & 255
	frame[3]=payload.size() & 255
	frame.append_array(payload)
	outgoing.append_array(frame)
	return sequence

func fail(reason: String) -> void:
	close()
	connection_lost.emit(reason)

func _process(delta: float) -> void:
	if not connecting and not connected: return
	tcp.poll()
	var status := tcp.get_status()
	if status == StreamPeerTCP.STATUS_ERROR or (connected and status == StreamPeerTCP.STATUS_NONE):
		fail("TCP connection failed; check server and port forwarding / TCP 连接失败，请检查服务端和端口映射" if connecting else "Connection lost / 连接已断开")
		return
	if connecting and Time.get_ticks_msec() - started > 12000:
		fail("Connection timeout / 连接超时")
		return
	if status != StreamPeerTCP.STATUS_CONNECTED: return
	if stream == null:
		tcp.set_no_delay(true)
		if use_tls:
			secure = StreamPeerTLS.new()
			if secure.connect_to_stream(tcp, host, TLSOptions.client()) != OK:
				fail("TLS setup failed")
				return
			stream = secure
		else: stream = tcp
	if use_tls:
		secure.poll()
		if secure.get_status() == StreamPeerTLS.STATUS_HANDSHAKING: return
		if secure.get_status() != StreamPeerTLS.STATUS_CONNECTED:
			fail("TLS certificate/handshake failed / TLS 证书或握手失败")
			return
	connected = true
	connecting = false
	heartbeat += delta
	if heartbeat > 25:
		heartbeat = 0
		request("hello")
	if not outgoing.is_empty():
		var sent := stream.put_partial_data(outgoing)
		if sent[0] != OK:
			fail("Send failed")
			return
		outgoing = outgoing.slice(int(sent[1]))
	var count := stream.get_available_bytes()
	if count > 0:
		var received := stream.get_partial_data(mini(count, 1024 * 1024))
		if received[0] != OK:
			fail("Receive failed")
			return
		incoming.append_array(received[1])
	if incoming.size()>=4 and incoming.slice(0,4).get_string_from_ascii()=="HTTP":
		fail("HTTP endpoint, not game TCP: forward to the server TCP port (default 3211) / 当前端口是网页服务，请将转发目标改为游戏 TCP 端口（默认 3211）")
		return
	while incoming.size() >= 4:
		var length := (int(incoming[0]) << 24) | (int(incoming[1]) << 16) | (int(incoming[2]) << 8) | int(incoming[3])
		if length < 1 or length > MAX_FRAME:
			fail("Not a Squarelands TCP response; check forwarding target / 收到非游戏 TCP 数据，请检查端口转发目标")
			return
		if incoming.size() < length + 4: break
		var value = JSON.parse_string(incoming.slice(4, length + 4).get_string_from_utf8())
		incoming = incoming.slice(length + 4)
		if not value is Dictionary:
			fail("Invalid server message")
			return
		message.emit(value)
